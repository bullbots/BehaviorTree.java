# BehaviorTree.java Academy

A **fully local, Codecademy-style course** that teaches [BehaviorTree.java](https://github.com/bullbots/BehaviorTree.java) —
the faithful Java port of BehaviorTree.CPP v4 for FRC / WPILib — through 9 spiral units, live quizzes,
and (fourteen) interactive exercises that run on a JS re-implementation of the engine.

## Run it

Any static server works:

```bash
cd docs/learn
python -m http.server 8420        # then open http://localhost:8420/
# or
./start.sh                        # (start.cmd on Windows)
```

No build step, no npm, no CDN — everything is plain HTML/CSS/ES modules and works offline.

## What you get

| Unit | Topic |
|------|-------|
| 1 | First Tick — what BTs are, NodeStatus anatomy, the tick loop |
| 2 | Writing Trees in XML — root/BehaviorTree, Fallback + conditions, the Java runtime loop |
| 3 | Your Own Nodes (Java) — SyncActionNode, ports, registerNodeType/SimpleActionNode |
| 4 | Data on the Blackboard — literals vs `{pointers}`, SetBlackboard, `<Script>`, type-lock |
| 5 | RUNNING & Stateful Nodes — onStart/onRunning/onHalted, halting, sequence memory |
| 6 | Control-Flow Mastery — Switch/IfThenElse/WhileDoElse, Parallel thresholds, decorators |
| 7 | Subtrees, Remapping & Big Trees — `<SubTree>`, `_autoremap`, `{=}`, `<TreeNodesModel>` |
| 8 | The Scripting Language — operators, `:=` vs `=`, enums, conditional attributes |
| 9 | On the Robot (WPILib) + Capstone — CommandActionNode, BehaviorTreeCommand, NTBehaviorTreeLogger |

Progress is stored in `localStorage` (`Reset all progress` on the home page).

## The simulator

Exercises run on `js/engine/` — a faithful JavaScript re-implementation mirroring the Java port:

- 1 tick = **50 simulated ms**; polled `Timeout`/`Delay`/`Sleep` anchor deadlines at tick start,
  so `Timeout msec="300"` fails exactly on tick 6 (same sampling semantics as the Java
  poll-based implementation, with a deterministic clock instead of `Timer.getFPGATimestamp()`).
- Blackboard type-lock is byte-for-byte the Java behavior: strong typing from the first typed
  write, `NumericCast.isSafe` for numbers, String/Integer/Double lock classes, `@key` root escape,
  subtree remaps and `_autoremap` write-through (`createEntryImpl` parity).
- The scripted language matches `scripting/`: all numbers are Doubles, comparisons/logic yield
  `1.0`/`0.0`, Python-style chained comparisons, `:=` vs `=` creation semantics, enum registry.
- WPILib leaves are mocked exactly like `CommandActionNode`: fresh command per IDLE start,
  RUNNING-while-scheduled, cancel on halt, driven by an exercise-local `beforeTick` scheduler.

`test.html` runs the full engine fidelity suite (also runnable with `node docs/learn/_smoke.mjs`).

## Layout

```
index.html          shell (sidebar, router, lesson + quiz renderers)
css/                Codecademy-style theme + workspace styles
js/app/             router · store · curriculum · workspace (editor/visualizer/grader)
js/app/units/       the 9 unit content files (lessons, quizzes, exercises)
js/engine/          blackboard · script · xmltext · nodes · factory · runner · clock · tests
```

Content teaches the repo's `java/behaviortree-core` + `java/behaviortree-wpilib`; code studies quote
the actual Java sources (BehaviorTreeCommand, CommandActionNode, Blackboard, ScriptParser...).
