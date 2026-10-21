"""Fine-tune the walk networks into a 10 m/s sprint.

The published policies already balance. Their weights initialize an actor
with the same LSTM, and PPO then raises the speed command toward 10 m/s.
The reward is forward speed down the lane. A fall ends the episode.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import mujoco
import numpy as np
import torch
import torch.nn as nn

from scene import RACE_DISTANCE, ROBOTS, lane_center
from train import compile_one

ROOT = Path(__file__).resolve().parent
DT = 0.002
DECIMATION = 10
TARGET = 10.0


class SprintActor(nn.Module):
    def __init__(self, nobs: int, nact: int):
        super().__init__()
        self.lstm = nn.LSTM(nobs, 64, batch_first=True)
        self.actor = nn.Sequential(nn.Linear(64, 32), nn.ELU(), nn.Linear(32, nact))
        self.log_std = nn.Parameter(torch.full((nact,), -3.0))
        self.critic = nn.Sequential(
            nn.Linear(nobs, 128),
            nn.ELU(),
            nn.Linear(128, 128),
            nn.ELU(),
            nn.Linear(128, 1),
        )

    def load_walk(self, path: Path):
        scripted = torch.jit.load(str(path), map_location="cpu")
        weights = dict(scripted.named_parameters())
        with torch.no_grad():
            self.lstm.weight_ih_l0.copy_(weights["memory.weight_ih_l0"])
            self.lstm.weight_hh_l0.copy_(weights["memory.weight_hh_l0"])
            self.lstm.bias_ih_l0.copy_(weights["memory.bias_ih_l0"])
            self.lstm.bias_hh_l0.copy_(weights["memory.bias_hh_l0"])
            self.actor[0].weight.copy_(weights["actor.0.weight"])
            self.actor[0].bias.copy_(weights["actor.0.bias"])
            self.actor[2].weight.copy_(weights["actor.2.weight"])
            self.actor[2].bias.copy_(weights["actor.2.bias"])

    def act(self, obs: torch.Tensor, state):
        out, state = self.lstm(obs.unsqueeze(1), state)
        mean = self.actor(out.squeeze(1))
        std = self.log_std.exp().expand_as(mean)
        dist = torch.distributions.Normal(mean, std)
        action = dist.sample()
        return action, dist.log_prob(action).sum(-1), self.critic(obs).squeeze(-1), state

    def evaluate(self, obs: torch.Tensor, action: torch.Tensor, state):
        # state is the hidden state BEFORE this observation, stored per step.
        out, _ = self.lstm(obs.unsqueeze(1), state)
        mean = self.actor(out.squeeze(1))
        std = self.log_std.exp().expand_as(mean)
        dist = torch.distributions.Normal(mean, std)
        return dist.log_prob(action).sum(-1), dist.entropy().sum(-1), self.critic(obs).squeeze(-1)


class SprintEnv:
    def __init__(self, robot: dict, num_envs: int):
        self.robot = robot
        self.model, _ = compile_one(robot)
        self.envs = [mujoco.MjData(self.model) for _ in range(num_envs)]
        self.n = len(robot["default_angles"])
        self.default = np.asarray(robot["default_angles"], dtype=np.float64)
        self.kps = np.asarray(robot["kps"], dtype=np.float64)
        self.kds = np.asarray(robot["kds"], dtype=np.float64)
        prefix = f"{robot['id']}_"
        source = mujoco.MjModel.from_xml_path(str(robot["xml"]))
        names = [mujoco.mj_id2name(source, mujoco.mjtObj.mjOBJ_ACTUATOR, i) for i in range(source.nu)]
        self.joint_names = names
        self.sagittal = np.array(
            [index for index, name in enumerate(names) if "hip_pitch" in name or "knee" in name],
            dtype=np.int32,
        )
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
        self.nobs = 9 + 3 * self.n + 2
        self.num_envs = num_envs
        self.prev = np.zeros((num_envs, self.n), dtype=np.float64)
        self.time = np.zeros(num_envs, dtype=np.float64)
        self.age = np.zeros(num_envs, dtype=np.float64)
        self.x0 = np.zeros(num_envs, dtype=np.float64)
        self.command = 1.5
        self.period = 0.8
        self.stride_gain = 1.0
        self.since_ramp = 0
        # Training-wheel torque about the pitch axis. Annealed to zero before a
        # checkpoint is allowed to count as a real sprint.
        self.spring = 0.0
        self.stand_z = float(self.model.qpos0[self.free_q + 2])

    def reset_one(self, index: int):
        data = self.envs[index]
        mujoco.mj_resetData(self.model, data)
        data.qpos[self.free_q + 1] = lane_center(self.robot["lane"])
        data.qpos[self.qadr] = self.default
        self.prev[index] = 0.0
        self.time[index] = 0.0
        # Stagger timeouts so the whole batch does not reset on one step.
        self.age[index] = float(np.random.uniform(0.0, 6.0))
        mujoco.mj_forward(self.model, data)
        self.x0[index] = float(data.qpos[self.free_q])

    def reset_all(self):
        for index in range(self.num_envs):
            self.reset_one(index)

    def observe(self) -> np.ndarray:
        obs = np.zeros((self.num_envs, self.nobs), dtype=np.float32)
        cmd_scale = np.asarray(self.robot["cmd_scale"], dtype=np.float64)
        for index, data in enumerate(self.envs):
            quat = data.qpos[self.free_q + 3 : self.free_q + 7]
            qw, qx, qy, qz = [float(v) for v in quat]
            yaw = np.arctan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
            y_error = lane_center(self.robot["lane"]) - float(data.qpos[self.free_q + 1])
            lateral = max(-0.3, min(0.3, 0.7 * y_error * np.cos(yaw)))
            yaw_rate = max(-0.5, min(0.5, -1.2 * yaw))
            phase = (self.time[index] % self.period) / self.period
            obs[index, 0:3] = data.qvel[self.free_v + 3 : self.free_v + 6] * self.robot["ang_vel_scale"]
            obs[index, 3] = 2 * (-qz * qx + qw * qy)
            obs[index, 4] = -2 * (qz * qy + qw * qx)
            obs[index, 5] = 1 - 2 * (qw * qw + qz * qz)
            obs[index, 6:9] = np.array([self.command, lateral, yaw_rate]) * cmd_scale
            obs[index, 9 : 9 + self.n] = (data.qpos[self.qadr] - self.default) * self.robot["dof_pos_scale"]
            obs[index, 9 + self.n : 9 + 2 * self.n] = data.qvel[self.dadr] * self.robot["dof_vel_scale"]
            obs[index, 9 + 2 * self.n : 9 + 3 * self.n] = self.prev[index]
            obs[index, -2] = np.sin(2 * np.pi * phase)
            obs[index, -1] = np.cos(2 * np.pi * phase)
        return obs

    def step(self, action: np.ndarray):
        action = np.clip(action, -3.0, 3.0)
        scale = np.full(self.n, self.robot["action_scale"])
        scale[self.sagittal] *= self.stride_gain
        target = action * scale + self.default
        reward = np.zeros(self.num_envs, dtype=np.float32)
        done = np.zeros(self.num_envs, dtype=np.bool_)
        speed = np.zeros(self.num_envs, dtype=np.float32)
        x_before = np.array([float(data.qpos[self.free_q]) for data in self.envs])
        for _ in range(DECIMATION):
            for index, data in enumerate(self.envs):
                tau = (target[index] - data.qpos[self.qadr]) * self.kps - data.qvel[self.dadr] * self.kds
                data.ctrl[self.act_ids] = tau
                mujoco.mj_step(self.model, data)
            self.time += DT
            self.age += DT
        for index, data in enumerate(self.envs):
            x = float(data.qpos[self.free_q])
            vx = (x - x_before[index]) / (DECIMATION * DT)
            speed[index] = vx
            height = float(data.qpos[self.free_q + 2])
            qw, qx, qy, qz = [float(v) for v in data.qpos[self.free_q + 3 : self.free_q + 7]]
            upright = 1 - 2 * (qw * qw + qz * qz)
            y_error = float(data.qpos[self.free_q + 1]) - lane_center(self.robot["lane"])
            # Speed is paid directly. Matching the command is a wide bonus, so a
            # command the body cannot reach yet does not make the current gait
            # look like a failure and erase it.
            reward[index] = (
                0.45 * max(min(vx, 12.0), 0.0)
                + 0.35 * np.exp(-((vx - self.command) ** 2) / 2.5)
                + 0.25 * np.exp(-((vx - TARGET) ** 2) / 18.0)
                + 0.2 * max(0.0, -upright)
                - 0.08 * y_error**2
                - 0.01 * float(np.square(action[index] - self.prev[index]).mean())
            )
            if x >= RACE_DISTANCE:
                reward[index] += 8.0
                done[index] = True
            if height < 0.5 * self.stand_z or abs(y_error) > 1.6 or self.age[index] > 8.0:
                if height < 0.5 * self.stand_z:
                    reward[index] -= 3.0
                done[index] = True
        self.prev[:] = action
        reset = np.where(done)[0]
        return reward, done, speed, reset


def train(robot_id: str, iterations: int, num_envs: int, horizon: int, seed: int):
    torch.manual_seed(seed)
    np.random.seed(seed)
    robot = next(item for item in ROBOTS if item["id"] == robot_id)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    env = SprintEnv(robot, num_envs)
    net = SprintActor(env.nobs, env.n)
    net.load_walk(robot["policy"])
    net.to(device)
    optimizer = torch.optim.Adam(net.parameters(), lr=2e-4)
    env.reset_all()
    h = torch.zeros(1, num_envs, 64, device=device)
    c = torch.zeros(1, num_envs, 64, device=device)
    gamma, lam, clip = 0.99, 0.95, 0.2
    save_path = ROOT / "policies" / f"{robot_id}_sprint.pt"
    save_path.parent.mkdir(exist_ok=True)
    best_speed = -1.0

    for iteration in range(iterations):
        buf = {key: [] for key in ("obs", "act", "logp", "rew", "val", "done")}
        speeds = []
        h_start, c_start = h.detach().clone(), c.detach().clone()
        for _ in range(horizon):
            obs = env.observe()
            obs_t = torch.as_tensor(obs, device=device)
            with torch.no_grad():
                action, logp, value, (h, c) = net.act(obs_t, (h, c))
            reward, done, speed, reset = env.step(action.detach().cpu().numpy())
            buf["obs"].append(obs)
            buf["act"].append(action.detach().cpu().numpy())
            buf["logp"].append(logp.detach().cpu().numpy())
            buf["rew"].append(reward)
            buf["val"].append(value.detach().cpu().numpy())
            buf["done"].append(done)
            speeds.append(speed)
            if len(reset):
                h[:, reset, :] = 0
                c[:, reset, :] = 0
                for index in reset:
                    env.reset_one(int(index))
        with torch.no_grad():
            last = net.critic(torch.as_tensor(env.observe(), device=device)).squeeze(-1).cpu().numpy()
        rew = np.stack(buf["rew"])
        val = np.stack(buf["val"])
        done_b = np.stack(buf["done"])
        adv = np.zeros_like(rew)
        gae = np.zeros(num_envs, dtype=np.float32)
        for t in range(horizon - 1, -1, -1):
            mask = 1.0 - done_b[t]
            next_v = last if t == horizon - 1 else val[t + 1]
            delta = rew[t] + gamma * next_v * mask - val[t]
            gae = delta + gamma * lam * mask * gae
            adv[t] = gae
        ret = adv + val
        obs_b = torch.as_tensor(np.concatenate(buf["obs"]), device=device)
        act_b = torch.as_tensor(np.concatenate(buf["act"]), device=device)
        logp_b = torch.as_tensor(np.concatenate(buf["logp"]), device=device)
        # Hidden state going INTO each stored step is the state after the
        # previous step. Shift so evaluate replays the same transition.
        adv_b = torch.as_tensor(adv.reshape(-1), device=device)
        ret_b = torch.as_tensor(ret.reshape(-1), device=device)
        adv_b = (adv_b - adv_b.mean()) / (adv_b.std() + 1e-8)
        obs_seq = torch.as_tensor(np.stack(buf["obs"]), device=device)
        act_seq = torch.as_tensor(np.stack(buf["act"]), device=device)
        old_logp = torch.as_tensor(np.stack(buf["logp"]), device=device)
        for _ in range(3):
            hh = h_start.detach()
            cc = c_start.detach()
            logps = []
            ents = []
            values = []
            for t in range(horizon):
                dist_obs = obs_seq[t]
                out, (hh, cc) = net.lstm(dist_obs.unsqueeze(1), (hh, cc))
                mean = net.actor(out.squeeze(1))
                std = net.log_std.exp().expand_as(mean)
                dist = torch.distributions.Normal(mean, std)
                logps.append(dist.log_prob(act_seq[t]).sum(-1))
                ents.append(dist.entropy().sum(-1))
                values.append(net.critic(dist_obs).squeeze(-1))
                # Episodes that ended do not carry memory into the next row.
                ended = torch.as_tensor(done_b[t], device=device)
                hh = hh * (~ended).view(1, -1, 1)
                cc = cc * (~ended).view(1, -1, 1)
            logp = torch.stack(logps).reshape(-1)
            entropy = torch.stack(ents).reshape(-1)
            value = torch.stack(values).reshape(-1)
            ratio = torch.exp(logp - old_logp.reshape(-1))
            policy_loss = -torch.min(
                ratio * adv_b, torch.clamp(ratio, 1 - clip, 1 + clip) * adv_b
            ).mean()
            value_loss = 0.5 * (value - ret_b).pow(2).mean()
            # Let the critic learn the walk before the actor is allowed to move.
            if iteration < 8:
                loss = value_loss
            else:
                loss = policy_loss + value_loss - 0.002 * entropy.mean()
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), 0.5)
            optimizer.step()
        flat = np.concatenate(speeds)
        mean_speed = float(np.mean(flat))
        median_speed = float(np.median(flat))
        used_command = float(env.command)
        used_period = float(env.period)
        used_gain = float(env.stride_gain)
        env.since_ramp += 1

        def apply_clock():
            if env.command < 2.0:
                env.period = 0.8
            elif env.command < 4.0:
                env.period = max(0.42, 1.15 / env.command)
            else:
                env.period = max(0.30, 1.05 / env.command)

        # Keep the command just ahead of the pace they can actually hold.
        # A command several m/s too high makes the walk stumble and erases it.
        if iteration >= 8 and done_b.mean() < 0.12 and env.since_ramp >= 4 and env.command < TARGET:
            if median_speed > env.command - 0.35:
                env.command = min(TARGET, round(env.command + 0.2, 2))
                if env.command >= 2.4:
                    env.stride_gain = min(2.6, env.stride_gain + 0.03)
                env.since_ramp = 0
                apply_clock()
            elif env.since_ramp >= 14 and median_speed < env.command - 0.7:
                env.command = max(1.5, round(median_speed + 0.3, 2))
                env.stride_gain = max(1.0, env.stride_gain - 0.03)
                env.since_ramp = 0
                apply_clock()
        print(
            f"{robot_id} iter {iteration:03d}  v {median_speed:5.2f} m/s  "
            f"mean {mean_speed:5.2f}  cmd {used_command:4.1f}  "
            f"T {used_period:.2f}  stride {used_gain:.2f}  spring {env.spring:5.1f}  "
            f"reward {rew.mean():6.3f}  falls {done_b.mean():4.2f}",
            flush=True,
        )
        # A checkpoint only counts once the pitch spring is gone.
        if median_speed > best_speed and done_b.mean() < 0.35 and env.spring < 1.0:
            best_speed = median_speed
            torch.save(
                {
                    "model": net.state_dict(),
                    "robot": robot_id,
                    "nobs": env.nobs,
                    "nact": env.n,
                    "command": used_command,
                    "period": used_period,
                    "stride_gain": used_gain,
                    "speed": median_speed,
                },
                save_path,
            )
    print(f"saved {save_path} at {best_speed:.2f} m/s")


def main():
    parser = argparse.ArgumentParser(description="Fine-tune a humanoid toward 10 m/s")
    parser.add_argument("--robot", default="g1", choices=[robot["id"] for robot in ROBOTS])
    parser.add_argument("--iterations", type=int, default=400)
    parser.add_argument("--num-envs", type=int, default=48)
    parser.add_argument("--horizon", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    train(args.robot, args.iterations, args.num_envs, args.horizon, args.seed)


if __name__ == "__main__":
    main()
