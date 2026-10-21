"""Standard 100 m straight, then one humanoid per lane.

World Athletics straight: eight lanes of 1.22 m, 50 mm white lines,
no stagger. The running direction is +X. The start line is x = 0 and
the finish line is x = 100. There is track behind the start for the
blocks and a runoff after the finish.
"""

from __future__ import annotations

from pathlib import Path

import mujoco
import numpy as np

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "_vendor" / "unitree_rl_gym"

LANE_WIDTH = 1.22
LINE_WIDTH = 0.05
N_LANES = 8
RACE_DISTANCE = 100.0
TRACK_X0 = -8.0
TRACK_X1 = 118.0
TRACK_Y0 = 0.0
TRACK_Y1 = N_LANES * LANE_WIDTH

# Standing locomotion policies. Each one was trained with PPO and is the
# network Unitree ships for MuJoCo deployment of that humanoid.
ROBOTS = (
    {
        "id": "g1",
        "name": "Unitree G1",
        "lane": 3,
        "xml": VENDOR / "resources" / "robots" / "g1_description" / "g1_12dof.xml",
        "policy": VENDOR / "deploy" / "pre_train" / "g1" / "motion.pt",
        "kps": [100, 100, 100, 150, 40, 40, 100, 100, 100, 150, 40, 40],
        "kds": [2, 2, 2, 4, 2, 2, 2, 2, 2, 4, 2, 2],
        "default_angles": [-0.1, 0.0, 0.0, 0.3, -0.2, 0.0, -0.1, 0.0, 0.0, 0.3, -0.2, 0.0],
        "action_scale": 0.25,
        "ang_vel_scale": 0.25,
        "dof_pos_scale": 1.0,
        "dof_vel_scale": 0.05,
        "cmd_scale": [2.0, 2.0, 0.25],
        # Fastest command this walking policy can hold for a full 100 m.
        "speed": 2.0,
        "period": 0.55,
    },
    {
        "id": "h1",
        "name": "Unitree H1",
        "lane": 5,
        "xml": VENDOR / "resources" / "robots" / "h1" / "h1.xml",
        "policy": VENDOR / "deploy" / "pre_train" / "h1" / "motion.pt",
        "kps": [150, 150, 150, 200, 40, 150, 150, 150, 200, 40],
        "kds": [2, 2, 2, 4, 2, 2, 2, 2, 4, 2],
        "default_angles": [0.0, 0.0, -0.1, 0.3, -0.2, 0.0, 0.0, -0.1, 0.3, -0.2],
        "action_scale": 0.25,
        "ang_vel_scale": 0.25,
        "dof_pos_scale": 1.0,
        "dof_vel_scale": 0.05,
        "cmd_scale": [2.0, 2.0, 0.25],
        "speed": 1.6,
        "period": 0.70,
    },
    {
        "id": "h1_2",
        "name": "Unitree H1-2",
        "lane": 7,
        "xml": VENDOR / "resources" / "robots" / "h1_2" / "h1_2_12dof.xml",
        "policy": VENDOR / "deploy" / "pre_train" / "h1_2" / "motion.pt",
        "kps": [200, 200, 200, 300, 40, 40, 200, 200, 200, 300, 40, 40],
        "kds": [2.5, 2.5, 2.5, 4, 2, 2, 2.5, 2.5, 2.5, 4, 2, 2],
        "default_angles": [0.0, -0.16, 0.0, 0.36, -0.2, 0.0, 0.0, -0.16, 0.0, 0.36, -0.2, 0.0],
        "action_scale": 0.25,
        "ang_vel_scale": 0.25,
        "dof_pos_scale": 1.0,
        "dof_vel_scale": 0.05,
        "cmd_scale": [2.0, 2.0, 0.25],
        "speed": 1.6,
        "period": 0.70,
    },
)


def lane_center(lane: int) -> float:
    """Lane numbers are 1..8, inside to outside, along +Y."""
    return (lane - 0.5) * LANE_WIDTH


def _box(world, name, pos, size, rgba, friction=None, collide=True):
    geom = world.add_geom(
        name=name,
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=np.asarray(pos, dtype=float),
        size=np.asarray(size, dtype=float),
        rgba=np.asarray(rgba, dtype=float),
    )
    if friction is not None:
        geom.friction = np.asarray(friction, dtype=float)
    if not collide:
        geom.contype = 0
        geom.conaffinity = 0
    return geom


def build_track_spec() -> mujoco.MjSpec:
    spec = mujoco.MjSpec()
    spec.modelname = "100m"
    spec.option.timestep = 0.002
    spec.option.gravity = [0.0, 0.0, -9.81]
    spec.option.integrator = mujoco.mjtIntegrator.mjINT_EULER

    spec.visual.headlight.diffuse = [0.7, 0.7, 0.7]
    spec.visual.headlight.ambient = [0.35, 0.35, 0.35]
    spec.visual.headlight.specular = [0.4, 0.4, 0.4]
    spec.visual.global_.offwidth = 1280
    spec.visual.global_.offheight = 720
    sky = spec.add_texture(
        name="sky",
        type=mujoco.mjtTexture.mjTEXTURE_SKYBOX,
        builtin=mujoco.mjtBuiltin.mjBUILTIN_GRADIENT,
        rgb1=[0.45, 0.68, 0.92],
        rgb2=[0.96, 0.94, 0.88],
        width=512,
        height=3072,
    )
    del sky

    world = spec.worldbody
    world.add_light(
        pos=[50, -8, 18],
        dir=[-0.15, 0.25, -1],
        type=mujoco.mjtLightType.mjLIGHT_DIRECTIONAL,
        castshadow=True,
    )

    # Grass under and around the straight.
    _box(
        world,
        "infield",
        [(TRACK_X0 + TRACK_X1) / 2, TRACK_Y1 / 2, -0.08],
        [(TRACK_X1 - TRACK_X0) / 2 + 12, 22, 0.04],
        [0.20, 0.48, 0.26, 1],
        collide=False,
    )

    length = TRACK_X1 - TRACK_X0
    width = TRACK_Y1 - TRACK_Y0
    _box(
        world,
        "track",
        [(TRACK_X0 + TRACK_X1) / 2, TRACK_Y0 + width / 2, -0.02],
        [length / 2, width / 2, 0.02],
        [0.70, 0.16, 0.12, 1],
        friction=[1.8, 0.005, 0.0001],
    )

    def stripe(name, x, y, sx, sy, rgba):
        _box(world, name, [x, y, 0.008], [sx, sy, 0.006], rgba, collide=False)

    white = [0.95, 0.95, 0.95, 1]
    for i in range(N_LANES + 1):
        stripe(f"lane_line_{i}", (TRACK_X0 + TRACK_X1) / 2, i * LANE_WIDTH, length / 2, LINE_WIDTH / 2, white)
    stripe("start_line", 0.0, width / 2, LINE_WIDTH / 2, width / 2, white)
    stripe("finish_line", RACE_DISTANCE, width / 2, LINE_WIDTH / 2, width / 2, white)

    # Checker just past the finish, the usual way a straight is read on camera.
    checker = 0.28
    cols = 8
    for col in range(cols):
        for row in range(N_LANES * 2):
            if (col + row) % 2:
                continue
            stripe(
                f"check_{col}_{row}",
                RACE_DISTANCE + 0.2 + col * checker,
                (row + 0.5) * (width / (N_LANES * 2)),
                checker / 2,
                width / (N_LANES * 4),
                [0.08, 0.08, 0.08, 1],
            )

    for meter in range(10, 100, 10):
        stripe(f"mark_{meter}", meter, LINE_WIDTH, 0.04, 0.12, [0.95, 0.95, 0.95, 1])

    # Finish gantry. It does not collide, so a robot cannot hit the post.
    for side, y in (("l", -0.55), ("r", TRACK_Y1 + 0.55)):
        post = world.add_geom(
            name=f"post_{side}",
            type=mujoco.mjtGeom.mjGEOM_CYLINDER,
            pos=[RACE_DISTANCE, y, 1.7],
            size=[0.06, 1.7, 0],
            rgba=[0.12, 0.12, 0.12, 1],
        )
        post.contype = 0
        post.conaffinity = 0
    bar = world.add_geom(
        name="finish_bar",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[RACE_DISTANCE, width / 2, 3.35],
        size=[0.07, width / 2 + 0.7, 0.06],
        rgba=[0.96, 0.96, 0.96, 1],
    )
    bar.contype = 0
    bar.conaffinity = 0

    for spec_robot in ROBOTS:
        y = lane_center(spec_robot["lane"])
        # Two pedals behind the line. Visual only: the policies start standing.
        for side, dy in (("l", -0.09), ("r", 0.09)):
            quat = np.zeros(4)
            mujoco.mju_euler2Quat(quat, np.array([0.0, -0.45, 0.0]), "xyz")
            block = world.add_geom(
                name=f"block_{spec_robot['id']}_{side}",
                type=mujoco.mjtGeom.mjGEOM_BOX,
                pos=[-0.42, y + dy, 0.045],
                size=[0.14, 0.05, 0.035],
                rgba=[0.18, 0.18, 0.18, 1],
                quat=quat,
            )
            block.contype = 0
            block.conaffinity = 0
    return spec


def _isolate_robot_contacts(spec: mujoco.MjSpec, prefix: str, bit: int):
    """Feet collide with the track and not with the other runners."""
    for geom in spec.geoms:
        if not geom.name.startswith(prefix):
            continue
        if geom.contype == 0:
            continue
        geom.contype = bit
        geom.conaffinity = 1


def attach_robots(spec: mujoco.MjSpec) -> mujoco.MjSpec:
    for index, robot in enumerate(ROBOTS):
        child = mujoco.MjSpec.from_file(str(robot["xml"]))
        frame = spec.worldbody.add_frame(pos=[0.0, lane_center(robot["lane"]), 0.0])
        spec.attach(child, prefix=f"{robot['id']}_", frame=frame)
        _isolate_robot_contacts(spec, f"{robot['id']}_", bit=1 << (index + 1))
    # Track contype is 1. Each robot's colliding geoms use a unique bit and
    # affinity 1, so they meet the track and miss each other.
    return spec


def compile_race() -> tuple[mujoco.MjModel, mujoco.MjData]:
    spec = attach_robots(build_track_spec())
    model = spec.compile()
    data = mujoco.MjData(model)
    return model, data


def save_xml(path: Path) -> None:
    spec = attach_robots(build_track_spec())
    mesh_dirs = (
        ("h1_2_", VENDOR / "resources" / "robots" / "h1_2" / "meshes"),
        ("h1_", VENDOR / "resources" / "robots" / "h1" / "meshes"),
        ("g1_", VENDOR / "resources" / "robots" / "g1_description" / "meshes"),
    )
    for mesh in spec.meshes:
        for prefix, folder in mesh_dirs:
            if mesh.name.startswith(prefix):
                # Absolute, so to_xml can read the mesh. meshdir on the child
                # models is "meshes/", which would prefix a relative path.
                mesh.file = str((folder / mesh.file).resolve())
                break
    path.write_text(spec.to_xml(), encoding="utf-8")
