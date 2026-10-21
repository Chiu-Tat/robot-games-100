"""Train a 10 m/s sprint on top of the stable walk.

The published walk networks stay up near 1.5 m/s and fall when the command
is simply turned up. Search starts from that walk and adds a running residual:
a faster stride, more hip and knee travel, and balance feedback. Each sample
is a rollout on the 100 m track. The search keeps the runners that stay
upright and pulls their average speed toward 10 m/s.
"""

from __future__ import annotations

import json
from pathlib import Path

import mujoco
import numpy as np
import torch

from scene import ROBOTS, lane_center
from train import compile_one

ROOT = Path(__file__).resolve().parent
DT = 0.002
CONTROL_EVERY = 10
TARGET_SPEED = 10.0

# cmd, period, hip_amp, knee_swing, lean, ankle_amp, action_boost, k_pitch, k_roll, k_yaw
LOW = np.array([0.8, 0.22, -0.9, 0.0, 0.0, -0.45, 0.0, -0.8, -0.8, -0.6])
HIGH = np.array([10.0, 0.85, 0.9, 1.5, 0.7, 0.45, 0.8, 0.8, 0.8, 0.6])
PRIOR = np.array([1.6, 0.50, 0.0, 0.0, 0.0, 0.0, 0.0, 0.15, 0.1, 0.2])


def joint_index(names: list[str], side: str, token: str) -> int | None:
    for index, name in enumerate(names):
        if side in name and token in name:
            return index
    return None


def layout(names: list[str]) -> dict[str, int]:
    found = {}
    for side in ("left", "right"):
        for token in ("hip_pitch", "hip_roll", "hip_yaw", "knee", "ankle_pitch", "ankle_roll"):
            index = joint_index(names, side, token)
            if index is not None:
                found[f"{side}_{token}"] = index
        if f"{side}_ankle_pitch" not in found:
            index = joint_index(names, side, "ankle_joint")
            if index is not None:
                found[f"{side}_ankle"] = index
    return found


def clip_params(params: np.ndarray) -> np.ndarray:
    return np.minimum(HIGH, np.maximum(LOW, params))


def residual(params: np.ndarray, phase: float, pitch: float, roll: float, yaw: float, y_error: float, legs: dict[str, int], n: int) -> np.ndarray:
    _, _, hip_amp, knee_swing, lean, ankle_amp, _, k_pitch, k_roll, k_yaw = params
    s = np.sin(phase)
    c = np.cos(phase)
    out = np.zeros(n, dtype=np.float64)
    for sign, side in ((1.0, "left"), (-1.0, "right")):
        swing = max(0.0, sign * s)
        out[legs[f"{side}_hip_pitch"]] += -lean + hip_amp * sign * s + k_pitch * pitch
        if f"{side}_hip_roll" in legs:
            out[legs[f"{side}_hip_roll"]] += k_roll * roll + 0.15 * y_error
        if f"{side}_hip_yaw" in legs:
            out[legs[f"{side}_hip_yaw"]] += k_yaw * yaw
        out[legs[f"{side}_knee"]] += knee_swing * swing
        ankle = ankle_amp * sign * c
        if f"{side}_ankle_pitch" in legs:
            out[legs[f"{side}_ankle_pitch"]] += ankle
        elif f"{side}_ankle" in legs:
            out[legs[f"{side}_ankle"]] += ankle
    return out


class GaitEnv:
    def __init__(self, robot: dict):
        self.robot = robot
        self.model, self.data = compile_one(robot)
        self.policy = torch.jit.load(str(robot["policy"]), map_location="cpu")
        self.policy.eval()
        source = mujoco.MjModel.from_xml_path(str(robot["xml"]))
        names = [mujoco.mj_id2name(source, mujoco.mjtObj.mjOBJ_ACTUATOR, i) for i in range(source.nu)]
        prefix = f"{robot['id']}_"
        self.act_ids = np.array(
            [mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_ACTUATOR, prefix + name) for name in names]
        )
        self.qadr = np.array(
            [
                self.model.jnt_qposadr[mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, prefix + name)]
                for name in names
            ]
        )
        self.dadr = np.array(
            [
                self.model.jnt_dofadr[mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, prefix + name)]
                for name in names
            ]
        )
        free = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, prefix + "floating_base_joint")
        self.free_q = int(self.model.jnt_qposadr[free])
        self.free_v = int(self.model.jnt_dofadr[free])
        self.default = np.asarray(robot["default_angles"], dtype=np.float64)
        self.kps = np.asarray(robot["kps"], dtype=np.float64)
        self.kds = np.asarray(robot["kds"], dtype=np.float64)
        self.legs = layout(names)
        self.n = len(self.default)
        self.stand_z = float(self.model.qpos0[self.free_q + 2])
        self.cmd_scale = np.asarray(robot["cmd_scale"], dtype=np.float64)
        self.action_scale = float(robot["action_scale"])

    def _reset_memory(self):
        self.policy.hidden_state.zero_()
        self.policy.cell_state.zero_()

    def rollout(self, params: np.ndarray, seconds: float = 5.0) -> dict:
        params = clip_params(np.asarray(params, dtype=np.float64))
        cmd_speed, period, *rest = params
        action_boost = float(params[6])
        data = self.data
        model = self.model
        mujoco.mj_resetData(model, data)
        data.qpos[self.free_q + 1] = lane_center(self.robot["lane"])
        data.qpos[self.qadr] = self.default
        mujoco.mj_forward(model, data)
        self._reset_memory()
        action = np.zeros(self.n, dtype=np.float64)
        fell = False
        steps = int(seconds / DT)
        for step in range(steps):
            sim_time = step * DT
            quat = data.qpos[self.free_q + 3 : self.free_q + 7]
            qw, qx, qy, qz = [float(v) for v in quat]
            pitch = 2 * (-qz * qx + qw * qy)
            roll = -2 * (qz * qy + qw * qx)
            yaw = float(np.arctan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)))
            y_error = lane_center(self.robot["lane"]) - float(data.qpos[self.free_q + 1])
            if step % CONTROL_EVERY == 0:
                phase_clock = (sim_time % period) / period
                lateral = max(-0.3, min(0.3, 0.8 * y_error * np.cos(yaw)))
                yaw_rate = max(-0.5, min(0.5, -1.4 * yaw))
                obs = np.zeros(9 + 3 * self.n + 2, dtype=np.float32)
                obs[0:3] = data.qvel[self.free_v + 3 : self.free_v + 6] * self.robot["ang_vel_scale"]
                obs[3:6] = [pitch, roll, 1 - 2 * (qw * qw + qz * qz)]
                obs[6:9] = np.array([cmd_speed, lateral, yaw_rate]) * self.cmd_scale
                obs[9 : 9 + self.n] = (data.qpos[self.qadr] - self.default) * self.robot["dof_pos_scale"]
                obs[9 + self.n : 9 + 2 * self.n] = data.qvel[self.dadr] * self.robot["dof_vel_scale"]
                obs[9 + 2 * self.n : 9 + 3 * self.n] = action
                obs[-2:] = [np.sin(2 * np.pi * phase_clock), np.cos(2 * np.pi * phase_clock)]
                with torch.no_grad():
                    action = self.policy(torch.from_numpy(obs).unsqueeze(0)).numpy().squeeze()
            phase = 2 * np.pi * sim_time / period
            extra = residual(params, phase, pitch, roll, yaw, y_error, self.legs, self.n)
            target = action * (self.action_scale + action_boost) + self.default + extra
            data.ctrl[self.act_ids] = (target - data.qpos[self.qadr]) * self.kps - data.qvel[self.dadr] * self.kds
            mujoco.mj_step(model, data)
            if float(data.qpos[self.free_q + 2]) < 0.5 * self.stand_z:
                fell = True
                break
            if float(data.qpos[self.free_q]) >= 120.0:
                break
        distance = max(0.0, float(data.qpos[self.free_q]))
        duration = DT * (step + 1)
        speed = distance / max(duration, DT)
        if fell:
            score = distance - 40.0
        else:
            score = 70.0 - 8.0 * abs(speed - TARGET_SPEED) + 0.15 * distance
        return {
            "score": float(score),
            "distance": distance,
            "speed": float(speed),
            "fell": fell,
            "time": float(duration),
            "params": params,
        }


def search(robot_id: str, generations: int = 30, population: int = 36, seed: int = 0) -> dict:
    robot = next(item for item in ROBOTS if item["id"] == robot_id)
    env = GaitEnv(robot)
    rng = np.random.default_rng(seed)
    mean = PRIOR.copy()
    std = np.array([1.2, 0.08, 0.15, 0.15, 0.08, 0.08, 0.08, 0.1, 0.1, 0.1])
    elite_count = max(6, population // 6)
    best = None
    for generation in range(generations):
        samples = clip_params(mean + std * rng.normal(size=(population, mean.size)))
        samples[0] = clip_params(mean)
        scored = [env.rollout(sample) for sample in samples]
        scored.sort(key=lambda item: item["score"], reverse=True)
        elite = scored[:elite_count]
        mean = clip_params(np.mean([item["params"] for item in elite], axis=0))
        spread = np.std([item["params"] for item in elite], axis=0)
        std = np.minimum(0.9 * spread + 0.05 * std, np.array([2.0, 0.12, 0.25, 0.25, 0.12, 0.12, 0.15, 0.2, 0.2, 0.2]))
        top = scored[0]
        if best is None or top["score"] > best["score"]:
            best = top
        print(
            f"{robot_id} gen {generation:02d}  {top['speed']:5.2f} m/s  "
            f"x {top['distance']:6.1f}  fell {str(top['fell']):5}  best {best['speed']:5.2f}",
            flush=True,
        )
    # Re-time the winner over a longer window. The saved speed is this run.
    final = env.rollout(best["params"], seconds=12.0)
    payload = {
        "robot": robot_id,
        "params": final["params"].tolist(),
        "speed": final["speed"],
        "distance": final["distance"],
        "fell": final["fell"],
        "time": final["time"],
    }
    path = ROOT / "policies" / f"{robot_id}_sprint.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        f"saved {path}  {payload['speed']:.2f} m/s over {payload['time']:.1f}s "
        f"fell {payload['fell']}"
    )
    return payload


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train a 10 m/s sprint")
    parser.add_argument("--robot", default="g1", choices=[robot["id"] for robot in ROBOTS])
    parser.add_argument("--generations", type=int, default=28)
    parser.add_argument("--population", type=int, default=32)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    search(args.robot, args.generations, args.population, args.seed)
