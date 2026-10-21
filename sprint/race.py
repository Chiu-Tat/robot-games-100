"""Run the 100 m. Each humanoid is driven by its own trained policy.

The policies are the PPO networks Unitree publishes for MuJoCo deployment
(deploy/pre_train/*/motion.pt). Simulation is MuJoCo at 500 Hz. The networks
run at 50 Hz, which is the rate they were deployed at. A small yaw and
lateral command, the same joystick channels the policies were trained with,
keeps each runner in its lane.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import mujoco
import numpy as np
import torch

from scene import RACE_DISTANCE, ROBOTS, compile_race, lane_center, save_xml

DT = 0.002
DECIMATION = 10  # 50 Hz
GAIT_PERIOD = 0.8
ROOT = Path(__file__).resolve().parent


def gravity_orientation(quaternion: np.ndarray) -> np.ndarray:
    qw, qx, qy, qz = quaternion
    return np.array(
        [
            2 * (-qz * qx + qw * qy),
            -2 * (qz * qy + qw * qx),
            1 - 2 * (qw * qw + qz * qz),
        ],
        dtype=np.float64,
    )


def yaw_from_quat(quaternion: np.ndarray) -> float:
    qw, qx, qy, qz = quaternion
    return math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))


def wrap(angle: float) -> float:
    return (angle + math.pi) % (2 * math.pi) - math.pi


class Runner:
    def __init__(self, model: mujoco.MjModel, robot: dict):
        self.cfg = robot
        self.prefix = f"{robot['id']}_"
        self.policy = torch.jit.load(str(robot["policy"]), map_location="cpu")
        self.policy.eval()
        self.net = None
        self.h = None
        self.c = None
        self.gait_period = float(robot.get("period", GAIT_PERIOD))
        self.speed = float(robot["speed"])
        self.stride_gain = 1.0
        learned = ROOT / "policies" / f"{robot['id']}_sprint.pt"
        if learned.exists():
            checkpoint = torch.load(learned, map_location="cpu", weights_only=False)
            # Only replace the walk when the fine-tune is actually faster.
            if float(checkpoint.get("speed", 0.0)) >= 2.0:
                from sprint_train import SprintActor

                self.net = SprintActor(int(checkpoint["nobs"]), int(checkpoint["nact"]))
                self.net.load_state_dict(checkpoint["model"])
                self.net.eval()
                self.h = torch.zeros(1, 1, 64)
                self.c = torch.zeros(1, 1, 64)
                self.gait_period = float(checkpoint["period"])
                self.speed = float(checkpoint["command"])
                self.stride_gain = float(checkpoint.get("stride_gain", 1.0))
        self.kps = np.asarray(robot["kps"], dtype=np.float64)
        self.kds = np.asarray(robot["kds"], dtype=np.float64)
        self.default = np.asarray(robot["default_angles"], dtype=np.float64)
        self.n = self.default.shape[0]
        joint_names = []
        act_names = []
        # Actuator order in the source model is the policy's action order.
        source = mujoco.MjModel.from_xml_path(str(robot["xml"]))
        for act_id in range(source.nu):
            act_names.append(mujoco.mj_id2name(source, mujoco.mjtObj.mjOBJ_ACTUATOR, act_id))
        for name in act_names:
            joint_id = mujoco.mj_name2id(source, mujoco.mjtObj.mjOBJ_JOINT, name)
            joint_names.append(name if joint_id >= 0 else name)
        self.act_ids = np.array(
            [
                mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, self.prefix + name)
                for name in act_names
            ],
            dtype=np.int32,
        )
        self.qadr = np.array(
            [
                model.jnt_qposadr[
                    mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, self.prefix + name)
                ]
                for name in joint_names
            ],
            dtype=np.int32,
        )
        self.dadr = np.array(
            [
                model.jnt_dofadr[
                    mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, self.prefix + name)
                ]
                for name in joint_names
            ],
            dtype=np.int32,
        )
        free_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, self.prefix + "floating_base_joint")
        self.free_q = int(model.jnt_qposadr[free_id])
        self.free_v = int(model.jnt_dofadr[free_id])
        if np.any(self.act_ids < 0) or np.any(self.qadr < 0):
            raise RuntimeError(f"Could not find joints for {robot['name']}")
        self.action_scale = np.full(self.n, float(robot["action_scale"]))
        for index, name in enumerate(act_names):
            if "hip_pitch" in name or "knee" in name:
                self.action_scale[index] *= self.stride_gain
        self.action = np.zeros(self.n, dtype=np.float64)
        self.target = self.default.copy()
        self.finished_at = None
        self.fallen = False
        self.fall_time = None

    def reset_pose(self, data: mujoco.MjData, x: float):
        data.qpos[self.free_q : self.free_q + 3] = [x, lane_center(self.cfg["lane"]), data.qpos[self.free_q + 2]]
        data.qpos[self.free_q + 3 : self.free_q + 7] = [1, 0, 0, 0]
        data.qvel[self.free_v : self.free_v + 6] = 0
        for index, adr in enumerate(self.qadr):
            data.qpos[adr] = self.default[index]
            data.qvel[self.dadr[index]] = 0
        self.action[:] = 0
        self.target = self.default.copy()
        if self.h is not None:
            self.h.zero_()
            self.c.zero_()
        self.finished_at = None
        self.fallen = False
        self.fall_time = None

    def command(self, data: mujoco.MjData) -> np.ndarray:
        pos = data.qpos[self.free_q : self.free_q + 3]
        quat = data.qpos[self.free_q + 3 : self.free_q + 7]
        yaw = yaw_from_quat(quat)
        y_error = lane_center(self.cfg["lane"]) - pos[1]
        # Body frame: +X forward, +Y left, when yaw is 0.
        lateral = max(-0.25, min(0.25, 0.6 * y_error * math.cos(yaw)))
        yaw_rate = max(-0.4, min(0.4, -1.2 * wrap(yaw)))
        return np.array([self.speed, lateral, yaw_rate], dtype=np.float64)

    def act(self, model: mujoco.MjModel, data: mujoco.MjData, sim_time: float):
        q = data.qpos[self.qadr]
        dq = data.qvel[self.dadr]
        quat = data.qpos[self.free_q + 3 : self.free_q + 7]
        omega = data.qvel[self.free_v + 3 : self.free_v + 6] * self.cfg["ang_vel_scale"]
        phase = (sim_time % self.gait_period) / self.gait_period
        obs = np.zeros(9 + 3 * self.n + 2, dtype=np.float32)
        obs[0:3] = omega
        obs[3:6] = gravity_orientation(quat)
        obs[6:9] = self.command(data) * np.asarray(self.cfg["cmd_scale"])
        obs[9 : 9 + self.n] = (q - self.default) * self.cfg["dof_pos_scale"]
        obs[9 + self.n : 9 + 2 * self.n] = dq * self.cfg["dof_vel_scale"]
        obs[9 + 2 * self.n : 9 + 3 * self.n] = self.action
        obs[9 + 3 * self.n : 9 + 3 * self.n + 2] = [math.sin(2 * math.pi * phase), math.cos(2 * math.pi * phase)]
        obs_t = torch.from_numpy(obs).unsqueeze(0)
        with torch.no_grad():
            if self.net is None:
                action = self.policy(obs_t).detach().numpy().squeeze()
            else:
                hidden, (self.h, self.c) = self.net.lstm(obs_t.unsqueeze(1), (self.h, self.c))
                action = self.net.actor(hidden.squeeze(1)).detach().numpy().squeeze()
        self.action = np.asarray(action, dtype=np.float64).reshape(self.n)
        self.target = self.action * self.action_scale + self.default

    def torque(self, data: mujoco.MjData):
        q = data.qpos[self.qadr]
        dq = data.qvel[self.dadr]
        tau = (self.target - q) * self.kps + (0.0 - dq) * self.kds
        data.ctrl[self.act_ids] = tau

    def progress(self, data: mujoco.MjData) -> float:
        return float(data.qpos[self.free_q])

    def height(self, data: mujoco.MjData) -> float:
        return float(data.qpos[self.free_q + 2])

    def note_finish(self, data: mujoco.MjData, sim_time: float):
        if self.finished_at is None and self.progress(data) >= RACE_DISTANCE:
            self.finished_at = sim_time
        # A fall after the line is a runoff stumble, not a DNF.
        if self.finished_at is None and self.fall_time is None and self.height(data) < 0.45:
            self.fallen = True
            self.fall_time = sim_time


def settle(model, data, runners, seconds=0.4):
    """Hold the standing pose so the feet meet the track before the gun."""
    steps = int(seconds / DT)
    for runner in runners:
        runner.target = runner.default.copy()
    for _ in range(steps):
        for runner in runners:
            runner.torque(data)
        mujoco.mj_step(model, data)


def run_race(model, data, runners, seconds, record_every=10):
    steps = int(seconds / DT)
    times = []
    qpos = []
    for step in range(steps):
        sim_time = step * DT
        if step % DECIMATION == 0:
            for runner in runners:
                if not runner.fallen:
                    runner.act(model, data, sim_time)
        for runner in runners:
            runner.torque(data)
            runner.note_finish(data, sim_time)
        if step % record_every == 0:
            times.append(sim_time)
            qpos.append(data.qpos.copy())
        mujoco.mj_step(model, data)
        if all(r.finished_at is not None or r.fallen for r in runners):
            break
    return np.asarray(times), np.asarray(qpos)


def results_dict(runners, data) -> dict:
    rows = []
    for runner in runners:
        rows.append(
            {
                "id": runner.cfg["id"],
                "name": runner.cfg["name"],
                "lane": runner.cfg["lane"],
                "commanded_speed_mps": runner.speed,
                "distance_m": round(min(runner.progress(data), RACE_DISTANCE + 5), 2),
                "time_s": None if runner.finished_at is None else round(runner.finished_at, 2),
                "fallen": runner.fallen,
                "policy": str(runner.cfg["policy"].relative_to(ROOT.parent)),
            }
        )
    finished = [row for row in rows if row["time_s"] is not None and not row["fallen"]]
    finished.sort(key=lambda row: row["time_s"])
    for place, row in enumerate(finished, start=1):
        row["place"] = place
    return {"distance_m": RACE_DISTANCE, "runners": rows}


def overlay(frame, sim_time, runners, data):
    from PIL import Image, ImageDraw, ImageFont

    image = Image.fromarray(frame)
    draw = ImageDraw.Draw(image, "RGBA")
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 32)
        small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
        small = font
    draw.rectangle((24, 18, 430, 78), fill=(10, 10, 10, 160))
    draw.text((36, 26), f"100 m    {sim_time:5.1f} s", font=font, fill=(255, 255, 255, 255))
    y = 92
    order = sorted(runners, key=lambda r: -r.progress(data))
    for runner in order:
        label = f"L{runner.cfg['lane']}  {runner.cfg['name']}"
        crossed = runner.finished_at is not None and sim_time >= runner.finished_at
        down = runner.fall_time is not None and sim_time >= runner.fall_time and not crossed
        if crossed:
            label += f"   {runner.finished_at:.1f}s"
        elif down:
            label += "   DNF"
        else:
            label += f"   {max(0.0, runner.progress(data)):5.1f} m"
        draw.rectangle((24, y, 460, y + 34), fill=(10, 10, 10, 140))
        draw.text((36, y + 4), label, font=small, fill=(255, 255, 255, 255))
        y += 38
    return np.asarray(image)


def render_video(model, times, qpos, runners, path: Path, fps=30):
    import imageio.v2 as imageio

    path.parent.mkdir(parents=True, exist_ok=True)
    renderer = mujoco.Renderer(model, height=720, width=1280)
    camera = mujoco.MjvCamera()
    camera.type = mujoco.mjtCamera.mjCAMERA_FREE
    camera.distance = 14
    camera.azimuth = 90
    camera.elevation = -12
    # One video second per this many race seconds. A walking 100 m is a long
    # race; the clock on the frame is the race clock, not the video clock.
    race_span = max(float(times[-1]), 1.0)
    # Real time up to 40 s. A slow race is compressed so the video stays watchable.
    video_seconds = race_span if race_span <= 40.0 else 36.0
    stride_t = race_span / (video_seconds * fps)
    sample_times = np.arange(0, race_span, stride_t)
    data = mujoco.MjData(model)
    writer = imageio.get_writer(str(path), fps=fps, codec="libx264", quality=8)
    try:
        for stamp in sample_times:
            index = int(np.searchsorted(times, stamp, side="right") - 1)
            index = max(0, min(index, len(times) - 1))
            data.qpos[:] = qpos[index]
            mujoco.mj_forward(model, data)
            xs = [r.progress(data) for r in runners]
            camera.lookat[:] = [float(np.median(xs)), 4.9, 0.9]
            renderer.update_scene(data, camera=camera)
            writer.append_data(overlay(renderer.render(), float(times[index]), runners, data))
    finally:
        writer.close()
        renderer.close()


def main():
    model, data = compile_race()
    runners = [Runner(model, robot) for robot in ROBOTS]
    for runner in runners:
        runner.reset_pose(data, x=0.0)
    mujoco.mj_forward(model, data)
    settle(model, data, runners)
    # The gun: distance is measured from where they stand when timing starts.
    origins = {runner.cfg["id"]: runner.progress(data) for runner in runners}
    for runner in runners:
        # Shift the finish check by rewriting progress against the start line.
        # progress() reads world x. Robots are reset to x=0, and settle may
        # move them a few centimetres. Re-zero x so 100 m is 100 m.
        data.qpos[runner.free_q] = 0.0
        data.qvel[runner.free_v : runner.free_v + 6] = 0.0
    mujoco.mj_forward(model, data)

    print("Racing the full 100 m.")
    times, qpos = run_race(model, data, runners, seconds=180.0)
    summary = results_dict(runners, data)
    summary["start_x_after_settle"] = origins
    out = ROOT / "100m_race.npz"
    np.savez_compressed(out, time=times, qpos=qpos, dt=DT)
    xml_path = ROOT / "100m_race.xml"
    save_xml(xml_path)
    (ROOT / "results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    video = ROOT / "renders" / "100m.mp4"
    print("Rendering the broadcast.")
    render_video(model, times, qpos, runners, video)
    print(json.dumps(summary, indent=2))
    print(f"Wrote {out}")
    print(f"Wrote {xml_path}")
    print(f"Wrote {video}")


if __name__ == "__main__":
    main()
