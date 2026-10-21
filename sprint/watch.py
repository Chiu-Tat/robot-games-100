"""Play the recorded 100 m back in a MuJoCo window.

Reads sprint/100m_race.npz, which is the policy rollout. Playback is four
times the race clock so a full straight does not take a minute and a half.
Close the window to stop.
"""

from __future__ import annotations

import time
from pathlib import Path

import mujoco
import mujoco.viewer
import numpy as np

from race import Runner
from scene import ROBOTS, compile_race

ROOT = Path(__file__).resolve().parent
PLAYBACK = 4.0


def main():
    blob = np.load(ROOT / "100m_race.npz")
    times = blob["time"]
    qpos = blob["qpos"]
    model, data = compile_race()
    runners = [Runner(model, robot) for robot in ROBOTS]
    with mujoco.viewer.launch_passive(model, data) as viewer:
        viewer.cam.distance = 16
        viewer.cam.azimuth = 90
        viewer.cam.elevation = -14
        viewer.cam.lookat[:] = [6, 4.9, 0.9]
        start = time.time()
        span = float(times[-1]) if len(times) else 1.0
        while viewer.is_running():
            stamp = ((time.time() - start) * PLAYBACK) % span
            index = int(np.searchsorted(times, stamp, side="right") - 1)
            index = max(0, min(index, len(times) - 1))
            data.qpos[:] = qpos[index]
            mujoco.mj_forward(model, data)
            xs = [runner.progress(data) for runner in runners]
            viewer.cam.lookat[0] = float(np.median(xs))
            viewer.sync()
            time.sleep(0.02)


if __name__ == "__main__":
    main()
