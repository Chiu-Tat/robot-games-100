"""Train one humanoid to sprint the 100 m.

The scene is the same straight used for the race. The policy is a PPO actor
on the observation Unitree's deployed networks already use: body angular
velocity, gravity direction, a speed command, joint position and velocity,
the previous action, and a gait phase. The reward pays for holding a sprint
command down the lane and staying upright, and the episode ends on a fall
or at the finish line.

MuJoCo steps the physics. This is the same engine mjbatch batches; the
learning step runs on CUDA when a GPU is present.

    python train.py --robot g1 --iterations 200
"""

from __future__ import annotations

import argparse
from pathlib import Path

import mujoco
import numpy as np
import torch
import torch.nn as nn

from race import DT, gravity_orientation
from scene import RACE_DISTANCE, ROBOTS, lane_center

ROOT = Path(__file__).resolve().parent
DECIMATION = 10
COMMAND_SPEED = 3.0


def robot_by_id(robot_id: str) -> dict:
    for robot in ROBOTS:
        if robot["id"] == robot_id:
            return robot
    raise SystemExit(f"Unknown robot {robot_id}. Choices: {[r['id'] for r in ROBOTS]}")


def compile_one(robot: dict) -> tuple[mujoco.MjModel, mujoco.MjData]:
    """One runner, one lane, the same track surface as the race."""
    from scene import build_track_spec

    spec = build_track_spec()
    child = mujoco.MjSpec.from_file(str(robot["xml"]))
    frame = spec.worldbody.add_frame(pos=[0.0, lane_center(robot["lane"]), 0.0])
    spec.attach(child, prefix=f"{robot['id']}_", frame=frame)
    model = spec.compile()
    data = mujoco.MjData(model)
    return model, data


class ActorCritic(nn.Module):
    def __init__(self, nobs: int, nact: int):
        super().__init__()
        self.actor = nn.Sequential(
            nn.Linear(nobs, 256),
            nn.ELU(),
            nn.Linear(256, 256),
            nn.ELU(),
            nn.Linear(256, nact),
        )
        self.critic = nn.Sequential(
            nn.Linear(nobs, 256),
            nn.ELU(),
            nn.Linear(256, 256),
            nn.ELU(),
            nn.Linear(256, 1),
        )
        self.log_std = nn.Parameter(torch.full((nact,), -0.8))

    def dist(self, obs: torch.Tensor) -> torch.distributions.Normal:
        std = self.log_std.exp().expand_as(self.actor(obs))
        return torch.distributions.Normal(self.actor(obs), std)

    def act(self, obs: torch.Tensor):
        dist = self.dist(obs)
        action = dist.sample()
        logp = dist.log_prob(action).sum(-1)
        value = self.critic(obs).squeeze(-1)
        return action, logp, value

    def evaluate(self, obs: torch.Tensor, action: torch.Tensor):
        dist = self.dist(obs)
        logp = dist.log_prob(action).sum(-1)
        entropy = dist.entropy().sum(-1)
        value = self.critic(obs).squeeze(-1)
        return logp, entropy, value


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
        names = [
            mujoco.mj_id2name(source, mujoco.mjtObj.mjOBJ_ACTUATOR, i) for i in range(source.nu)
        ]
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
        free_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, prefix + "floating_base_joint")
        self.free_q = int(self.model.jnt_qposadr[free_id])
        self.free_v = int(self.model.jnt_dofadr[free_id])
        self.nobs = 9 + 3 * self.n + 2
        self.prev = np.zeros((num_envs, self.n), dtype=np.float64)
        self.time = np.zeros(num_envs, dtype=np.float64)

    def reset_one(self, index: int):
        data = self.envs[index]
        mujoco.mj_resetData(self.model, data)
        data.qpos[self.free_q + 1] = lane_center(self.robot["lane"])
        for j, adr in enumerate(self.qadr):
            data.qpos[adr] = self.default[j]
        self.prev[index] = 0
        self.time[index] = 0
        mujoco.mj_forward(self.model, data)

    def reset_all(self):
        for index in range(len(self.envs)):
            self.reset_one(index)
        return self.observe()

    def observe(self) -> np.ndarray:
        obs = np.zeros((len(self.envs), self.nobs), dtype=np.float32)
        cmd = np.array([COMMAND_SPEED, 0.0, 0.0]) * np.asarray(self.robot["cmd_scale"])
        for index, data in enumerate(self.envs):
            phase = (self.time[index] % 0.8) / 0.8
            quat = data.qpos[self.free_q + 3 : self.free_q + 7]
            obs[index, 0:3] = data.qvel[self.free_v + 3 : self.free_v + 6] * self.robot["ang_vel_scale"]
            obs[index, 3:6] = gravity_orientation(quat)
            obs[index, 6:9] = cmd
            obs[index, 9 : 9 + self.n] = (data.qpos[self.qadr] - self.default) * self.robot["dof_pos_scale"]
            obs[index, 9 + self.n : 9 + 2 * self.n] = data.qvel[self.dadr] * self.robot["dof_vel_scale"]
            obs[index, 9 + 2 * self.n : 9 + 3 * self.n] = self.prev[index]
            obs[index, -2:] = [np.sin(2 * np.pi * phase), np.cos(2 * np.pi * phase)]
        return obs

    def step(self, action: np.ndarray):
        action = np.clip(action, -1.5, 1.5)
        target = action * self.robot["action_scale"] + self.default
        reward = np.zeros(len(self.envs), dtype=np.float32)
        done = np.zeros(len(self.envs), dtype=np.bool_)
        for _ in range(DECIMATION):
            for index, data in enumerate(self.envs):
                if done[index]:
                    continue
                tau = (target[index] - data.qpos[self.qadr]) * self.kps - data.qvel[self.dadr] * self.kds
                data.ctrl[self.act_ids] = tau
                mujoco.mj_step(self.model, data)
            self.time += DT
        for index, data in enumerate(self.envs):
            vx = float(data.qvel[self.free_v])
            height = float(data.qpos[self.free_q + 2])
            upright = float(gravity_orientation(data.qpos[self.free_q + 3 : self.free_q + 7])[2])
            y_error = float(data.qpos[self.free_q + 1]) - lane_center(self.robot["lane"])
            speed_term = np.exp(-((vx - COMMAND_SPEED) ** 2) / 2.0)
            reward[index] = (
                2.0 * speed_term
                + 0.5 * max(vx, 0.0)
                + 0.4 * (1.0 + upright)
                - 0.05 * float(np.square(action[index] - self.prev[index]).mean())
                - 0.2 * y_error**2
            )
            x = float(data.qpos[self.free_q])
            if x >= RACE_DISTANCE:
                reward[index] += 20.0
                done[index] = True
            if height < 0.45 or abs(y_error) > 1.5 or upright > -0.3:
                reward[index] -= 2.0
                done[index] = True
            if self.time[index] > 20.0:
                done[index] = True
        self.prev[:] = action
        for index in range(len(self.envs)):
            if done[index]:
                self.reset_one(index)
        return self.observe(), reward, done


def train(robot_id: str, iterations: int, num_envs: int, horizon: int, seed: int):
    torch.manual_seed(seed)
    np.random.seed(seed)
    robot = robot_by_id(robot_id)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    env = SprintEnv(robot, num_envs)
    net = ActorCritic(env.nobs, env.n).to(device)
    optimizer = torch.optim.Adam(net.parameters(), lr=3e-4)
    obs = env.reset_all()
    gamma, lam, clip = 0.99, 0.95, 0.2
    out_dir = ROOT / "policies"
    out_dir.mkdir(exist_ok=True)

    for iteration in range(iterations):
        buf = {key: [] for key in ("obs", "act", "logp", "rew", "val", "done")}
        for _ in range(horizon):
            obs_t = torch.as_tensor(obs, device=device)
            with torch.no_grad():
                action, logp, value = net.act(obs_t)
            next_obs, reward, done = env.step(action.cpu().numpy())
            buf["obs"].append(obs)
            buf["act"].append(action.cpu().numpy())
            buf["logp"].append(logp.cpu().numpy())
            buf["rew"].append(reward)
            buf["val"].append(value.cpu().numpy())
            buf["done"].append(done)
            obs = next_obs
        with torch.no_grad():
            last = net.critic(torch.as_tensor(obs, device=device)).squeeze(-1).cpu().numpy()
        rew = np.stack(buf["rew"])
        val = np.stack(buf["val"])
        done = np.stack(buf["done"])
        adv = np.zeros_like(rew)
        gae = np.zeros(num_envs, dtype=np.float32)
        for t in range(horizon - 1, -1, -1):
            mask = 1.0 - done[t]
            next_v = last if t == horizon - 1 else val[t + 1]
            delta = rew[t] + gamma * next_v * mask - val[t]
            gae = delta + gamma * lam * mask * gae
            adv[t] = gae
        ret = adv + val
        obs_b = torch.as_tensor(np.concatenate(buf["obs"]), device=device)
        act_b = torch.as_tensor(np.concatenate(buf["act"]), device=device)
        logp_b = torch.as_tensor(np.concatenate(buf["logp"]), device=device)
        adv_b = torch.as_tensor(adv.reshape(-1), device=device)
        ret_b = torch.as_tensor(ret.reshape(-1), device=device)
        adv_b = (adv_b - adv_b.mean()) / (adv_b.std() + 1e-8)
        for _ in range(4):
            logp, entropy, value = net.evaluate(obs_b, act_b)
            ratio = torch.exp(logp - logp_b)
            loss = (
                -torch.min(ratio * adv_b, torch.clamp(ratio, 1 - clip, 1 + clip) * adv_b).mean()
                + 0.5 * (value - ret_b).pow(2).mean()
                - 0.005 * entropy.mean()
            )
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            optimizer.step()
        distance = float(np.mean([data.qpos[env.free_q] for data in env.envs]))
        print(f"iter {iteration:04d}  reward {rew.mean():6.3f}  x {distance:6.2f} m", flush=True)
        if (iteration + 1) % 25 == 0 or iteration + 1 == iterations:
            path = out_dir / f"{robot_id}_sprint.pt"
            torch.save({"model": net.state_dict(), "robot": robot_id, "nobs": env.nobs, "nact": env.n}, path)
            print(f"saved {path}")


def main():
    parser = argparse.ArgumentParser(description="Train a humanoid to sprint 100 m")
    parser.add_argument("--robot", default="g1", choices=[robot["id"] for robot in ROBOTS])
    parser.add_argument("--iterations", type=int, default=200)
    parser.add_argument("--num-envs", type=int, default=32)
    parser.add_argument("--horizon", type=int, default=64)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    train(args.robot, args.iterations, args.num_envs, args.horizon, args.seed)


if __name__ == "__main__":
    main()
