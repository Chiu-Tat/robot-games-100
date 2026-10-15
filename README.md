# Robot Games 100

One hundred sports, played by robots. Running, jumping, and every kind of ball — then water, ice, wheels, and the gym.

This repository is the catalog and the plan. The pages you can open today are animation: a robot acting out each sport so the set of games is visible. The work after that is simulation. Each game gets its own reinforcement-learning policy, trained in physics rather than posed by hand, and a single game can take several days. The first one is the 100m sprint.

## Watch the catalog

Open `index.html` in a browser. No install step.

The floor show walks through all 100 games. Pause it, step with the arrows, or search. "ball" returns the ball sports. Click a card for a larger view. A hash such as `#sprint` opens that game.

The families are Track, Jumps, Throws, Court, Field, Racquet, Precision, Combat, Water, Snow & Ice, Wheels, and Gym & Skill. The full list is `js/catalog.js`.

A 12-second cover is at `videos/robot-games-cover/renders/cover.mp4`. It starts on one robot, then pulls back until a field of robots is playing different games.

## From animation to a policy

The canvas in `js/stage.js` only draws a pose. It does not simulate contact, balance, or a finish line. Training will not extend that drawing. Each game gets a physics scene, a reward, and a policy.

The training stack is open source:

- [UniLab](https://github.com/unilabsim/UniLab) runs the learning loop. Simulation stays on the CPU. The policy update can run on a GPU, and the same project also trains on Apple Silicon. Tasks are chosen with its CLI (`uv run train`, `uv run eval`), including PPO on the MuJoCo backend.
- [mjbatch](https://github.com/unilabsim/mjbatch) is the batched MuJoCo engine UniLab builds against. One model is stepped in thousands of parallel simulations on CPU. [mjbatch_uni](https://github.com/unilabsim/mjbatch_uni) is the matching Python library when a task needs the batch API directly.

UniLab's own docs are the install guide: [UniLab documentation](https://unilabsim.github.io/UniLab-doc/en/1-getting_started/2-installation.html). This repo does not vendor that stack yet.

## Several days, one game

A game stays open until the policy can play it. The sprint is first. The 400m and the marathon come after it, each with its own stretch of days.

| Game | Id |
| --- | --- |
| 100m Sprint | `sprint` |
| 400m Dash | `dash` |
| Marathon | `marathon` |

A finished game has four pieces:

1. A MuJoCo scene for that sport: the robot, the ground, and whatever the game needs (blocks and a lane for the sprint, a ball and a goal later).
2. A reward and a terminal condition a policy can learn. For the sprint, that is forward progress down a 100m lane, staying upright, and stopping at the line.
3. A UniLab training run on the MuJoCo backend, so `mjbatch` is what steps the worlds.
4. A saved policy and a short note of what it learned, checked in next to that game.

The next game reuses the same robot and the same training loop. Only the scene and the reward change. Soccer needs a ball and a kick. A dive needs water. The catalog id is the name of the task either way.

## Layout

```
index.html              catalog page
css/arena.css           page styles
js/catalog.js           the 100 games
js/stage.js             canvas robot, for the catalog only
js/main.js              filters, search, and the floor show
videos/robot-games-cover/   cover film
```

Simulation tasks are not in the tree yet. They will sit beside the catalog, one folder per game id, starting with `sprint`.
