# AGENT.md — BehaviorTree.java Academy build handoff

> **How to resume:** the user will say *"continue using the information in AGENT.md"*.
> Everything needed to finish the project is in this file. Work through "Next steps" top-down,
> tick them off, and update this file before re-committing (only ever commit `AGENT.md` +
> `docs/learn/**` — the repo root contains upstream C++ sources that must not be touched).

## Mission (already approved by the user)

Build a **Codecademy-style, fully local learning website** that teaches the BehaviorTree.CPP
Java port for WPILib (`java/behaviortree-core` + `java/behaviortree-wpilib` in this repo).

- Location: **`docs/learn/`** (self-contained static site; vanilla HTML/CSS/JS ES modules; no CDN,
  no build step, no npm). Served via any static server; a `start` launcher is still to be added.
- **Spiral curriculum**: 9 units, gentle intro → WPILib capstone (detailed outline below).
- Exercises run on a **faithful JavaScript re-implementation of the engine** (`js/engine/`):
  users write real XML trees + real script-language code, and watch trees tick node-by-node
  with a visualizer + blackboard inspector.
- Codecademy visual style: navy sidebar `#152b39`, accent `#f65a5b`, success teal `#34b3a0`,
  white content panel, dark editor, progress rings, quiz banners, unit celebration screens.
- User picked: JS simulator (not real Java in browser) · Codecademy styling · `docs/learn` ·
  vanilla JS · Core+WPILib scope · progress+quizzes (+ 2-level hint popovers + reference cards).
- User is fine self-hosting on a server; simplest distribution remains static files.
- **End of project: git commit (only new files) and push.** Final deliverable must run with
  `python -m http.server` inside `docs/learn` (or a bundled `start.cmd`).

## Current status (Milestones)

| # | Milestone | State |
|---|-----------|-------|
| M1 | Shell (router/sidebar/theme/store/lesson+quiz renderers) | ✅ **verified in headless Chromium — all 85 item routes render with zero console errors** |
| M2 | Engine (blackboard/script/xml/nodes/factory/runner) | ✅ 40/40 engine fidelity tests, in node AND browser (`test.html`) |
| M3 | Workspace (editor/visualizer/blackboard/grading) | ✅ rendered verified; grader logic verified by `_validate.mjs` |
| M4 | Content units 1–9 | ✅ **COMPLETE — 30 lessons / 85 items / 10 quizzes / 22 exercises; every exercise has a `refXml` reference solution whose own validators pass 22/22** |
| M5 | Test harness page, launcher, README, polish | ✅ `test.html`, `start.cmd`/`start.sh`, `README.md` |
| M6 | Final verify + commit/push | 🔁 per-session commits; final sweep = user testing |

✅ **Stale "critical gap" resolved** (long ago): unit content lives at `js/app/units/unitN.js`.
Route guard in `router.js` protects lessons with 0 items; all shipped lessons have items.

## Repository context (facts that must stay accurate in lessons)

- Java module `behaviortree-core` in `java/behaviortree-core/src/main/java/org/behaviortree/core/`
  — pure-Java port of BehaviorTree.CPP v4, targeted at FRC/WPILib. Package `org.behaviortree.core`.
- `behaviortree-wpilib` (`java/behaviortree-wpilib/src/main/java/org/behaviortree/wpilib/`):
  `BehaviorTreeCommand extends Command` (requirements varargs; `initialize()` sets root reset +
  `_fpgaTimestamp`; `execute()` = **one `tree.tickOnce()` per scheduler run**; `isFinished()` =
  root SUCCESS/FAILURE; `end()` = `tree.haltTree()`), `CommandActionNode`
  (`onStart` schedules a **fresh** command each IDLE transition; RUNNING while scheduled; SUCCESS
  when not; `onHalted` cancels), `NTBehaviorTreeLogger` (per-node StringPublisher keyed by
  `fullPath()`, statuses to NetworkTables), `WpilibNodes.registerCommandAction(factory, id, supplier)`.
- Node classes to teach: `SyncActionNode` (ctor `(String name, NodeConfig config)`,
  `protected NodeStatus tick()`), `StatefulActionNode` (`onStart/onRunning/onHalted`),
  `ConditionNode` (never RUNNING), `registerNodeType("X", Class)` reflection requires public
  `(String, NodeConfig)` ctor + static `providedPorts()` **method** (no annotations!),
  `Port.list(Port.input(Double.class, "distance"), Port.output(...))`.
- `Tree`: `tickOnce()`, `tickWhileRunning(ms)`, `haltTree()`. `NodeStatus`: IDLE/RUNNING/SUCCESS/
  FAILURE/SKIPPED. `Blackboard`: type-lock ("once declared, the type of a port shall not change"),
  `@key` → root blackboard escape, safe numeric widening (int→double ok).
- Deliberate port differences to teach explicitly (java/README.md "Fidelity notes"):
  poll-based `Timeout`/`Delay`/`Sleep` (no timer thread), script numbers are doubles, `Loop`
  takes a blackboard queue (no XML `;`-list), **no `_halting`**, **no Groot2/ZeroMQ** —
  use `NTBehaviorTreeLogger` instead, no CoroActionNode.
- Builtin XML ids: Sequence/AsyncSequence/SequenceWithMemory(+alias SequenceStar)/
  Fallback/AsyncFallback/ReactiveSequence/ReactiveFallback/Parallel(success_count default -1,
  failure_count default 1)/ParallelAll(max_failures=1)/Switch2..Switch6 (variable, case_N,
  string→int→real epsilon compare; last child = default)/IfThenElse (NOT reactive, 2-3 kids)/
  WhileDoElse (reactive)/Inverter/RetryUntilSuccessful(alias Retry; num_attempts, -1 infinite)/
  Repeat(num_cycles)/Timeout(msec, 0=off)/Delay(delay_msec)/ForceSuccess/ForceFailure/
  KeepRunningUntilFailure/RunOnce(then_skip default true)/Precondition(if/else)/Loop(queue/
  if_empty/value)/SubTree(_autoremap, {=} alias, pointer remap)/SkipUnlessUpdated(entry →
  SKIPPED)/WaitValueUpdate(entry → RUNNING)/AlwaysSuccess/AlwaysFailure/Script(code)/
  ScriptCondition(code)/SetBlackboard(value/output_key)/UnsetBlackboard(key)/Sleep(msec).
- Special attributes: `_skipIf`,`_successIf`,`_failureIf`,`_while` (only one that interrupts
  RUNNING: false→halt+SKIPPED), post: `_onSuccess`,`_onFailure`,`_post`,`_onHalted`.
- Script language: `:=` create / `=` existing-only (throws otherwise), `+=` etc., chained
  comparisons `1<2<3`, ternary `? :`, `..` string concat, single-quoted strings only, hex ints,
  trailing last statement = result, enums via registry bare names, `@var3:=3` writes ROOT.
  All numbers are doubles internally.
- Reference robot project: `examples/wpilib-robot-example` (settings.gradle `includeBuild`,
  deploy/autonomous.xml with Intake→Timeout(4000)→Shoot, RobotContainer wiring, dashboard table).
- XML constants for lessons: `<root BTCPP_format="4" main_tree_to_execute="T">`, compact tags,
  explicit `<Action ID="X"/>` equivalence, `<TreeNodesModel>` with `<input_port name= default=>`.

## Files written so far (all under `docs/learn/`)

```
index.html                  — shell; loads css + js/app/app.js (ES module)
css/theme.css               — Codecademy-style theme (sidebar, quizzes, hero, buttons, cards)
css/workspace.css           — editor/visualizer/blackboard/console styles
js/app/app.js               — bootstrap: theme toggle, sidebar collapse, hash router hook
js/app/router.js            — hash parser: #/ | #/:uid | #/:uid/:lessonId(/:idx)
js/app/store.js             — localStorage progress ({done, data}, unitPercent, lastRoute)
js/app/units/unit1..9.js    — full content: 30 lessons / 85 items (41 reading, 10 java studies,
                              10 quizzes, 22 exercises each with refXml+validators+hints)
                              exercises embed node defs + beforeTick mock schedulers
js/app/sidebar.js           — Codecademy-like sidebar (units, rings, item kinds, progress bars)
js/app/pages.js             — home hero+unit cards; lesson crumb/progress/title;
                              block renderer hook; quiz renderer (immediate feedback);
                              exercise lazy-imports workspace.js; prev/next nav
js/app/render.js            — mdInline + renderBlocks (p/h/code/callout/list/table/…)
js/app/highlight.js         — hand-rolled syntax highlighters: xml / script / java
js/app/workspace.js         — exercise runner UI: XML editor+overlay highlight, Step/Run/
                              Pause/Reset/speed, SVG-less DOM tree visualizer, blackboard
                              table, console, "Run & check" grader, hint ladder
js/engine/clock.js          — STATUS enum, isCompleted/isActive, BTError/LogicError/
                              RuntimeError, virtual clock (1 tick = 50 ms, simClock.reset/now/ms)
js/engine/blackboard.js     — Blackboard (entries w/{value,type,locked,seq,stamp}, parent chain,
                              autoRemapping, remaps/subtree remapping, typedGet/manual CONV,
                              inferLiteral, type-lock + numeric widening; '@' → root)
js/engine/script.js         — script language: lexer+Pratt parser+evaluator matching Java
                              precedence (:= /= at 2, ?: 4, || 6, && 8, cmps 10, | ^ 12, & 14,
                              + - .. 16, * / 18, unary 20), compound assigns, EPS epsilon
                              compare, enums lookup, bool=1/0 as numbers
js/engine/xmltext.js        — minimal standalone XML parser (no DOMParser needed; node-
                              compatible; rejects DOCTYPE like upstream XXE hardening)
js/engine/nodes.js          — TreeNode.executeTick (pre/post condition scripts, exception wrap
                              into NodeExecutionError, SKIPPED keeps IDLE), ControlNode/Decorator
                              /Condition/SyncAction(no RUNNING)/StatefulAction(onStart/onRunning/
                              onHalted), ALL builtins ported 1:1 from java sources (verified by
                              reading each .java), virtual nodes: makeVirtualNode + manifestOfDef
                              (defs: {type:'action'|'condition'|'stateful'|'command', ports,
                              tick/onStart/onRunning/onHalted/supplier}), ctxOf(ctx) = getInput/
                              tryGetInput/setOutput/blackboard/log/node; CommandActionLike
                              mirrors wpilib CommandActionNode with `supplier()`
js/engine/factory.js        — Factory + Tree: XML → node instances; BUILT-IN registry; virtual
                              registration assumed via opts.nodes in createTreeFromText; SubTree
                              handling incl. `_autoremap`, `{=` alias`, pointer remaps, literal
                              pre-create, TreeNodesModel mandatory-port check; explicit tags
                              <Action ID> etc.; Tree.tickOnce/haltTree
js/engine/runner.js         — Runner: builds tree, simClock per run, tick()/runUntilFinished(max)
                              /reset()/snapshot()/tally() (ticksCount increments in executeTick
                              only when actually ticking); globalThis.__btLog collects ctx.log
_smoke.mjs                  — node driver that runs js/engine/tests.mjs (the ONE suite)
js/engine/tests.mjs         — THE engine fidelity suite (40 cases) — shared by node & test.html
_validate.mjs               — content validator: runs every exercise's refXml through its own
                              validators (22/22 passing). KEEP both and re-run after content edits.
test.html                   — in-browser page that runs js/engine/tests.mjs (40/40 in Chromium)
start.cmd / start.sh        — serve + open browser at :8420
README.md                   — what it is, how to run the course
```

## Next steps (in order)

1. ~~Run the smoke test and make it pass.~~ ✅ 40/40 (see "Engine fixes" below for the change log).
2. ~~Author the full unit content.~~ ✅ All 9 units written at `js/app/units/unitN.js`
   (30 lessons, 85 items: 41 reading, 10 java code-studies, 10 quizzes, 22 exercises — every
   exercise carries `refXml` + validators verified by `node docs/learn/_validate.mjs`).
3. ~~Browser verification.~~ ✅ Headless Chromium pass: home + all 85 item routes render error-free;
   quiz/exercise/reading components render; had three UI bugs to fix along the way (store
   `unitPercent`, missing `export renderNotFound`, a numeric table cell).
4. ~~Launcher + README + test.html.~~ ✅
5. **Remaining (for the user's own test pass):** click through in a normal browser with real
   progress flow (localStorage), confirm quizzes grade, exercises accept validators, theme
   toggle + sidebar collapse feel right, and report/dark-mode contrast nits. Engine + grader
   logic are already machine-verified; what remains is subjective UX only.
6. If content edits happen later: run `node docs/learn/_smoke.mjs` and `node docs/learn/_validate.mjs`
   after every content change. `test.html` mirrors the smoke suite in-browser.

## Known issues / be-suspicious list (from the first draft pass)

Resolved across this build session (keep the list closed unless symptoms reappear):
- store.js `unitPercent` called the unit object as a function → **fixed in headless pass**
- pages.js `renderNotFound` was not exported → **fixed**
- workspace.js: pause/stopLoop label restore, duplicated `startLoop`, dead `_lastTouchedUid` gold
  flash → **fixed** (per-tick highlight now diffs snapshot statuses)
- u6/u8/u9 exercise design bugs found by `_validate.mjs` → all fixed (missing beforeTick stepping,
  duplicate node names in tallies, wrong ref arithmetic, `Timeout` one-child rule in capstone)
- unit6 Parallel table numeric cell crashed mdInline → **fixed**

Still open (subjective, user-testing tier):
- Dark-mode contrast nits, perfect quiz retry feel, UnitComplete overlay id-collision when
  pressed twice quickly (cosmetic; rendering verified once), `highlight.js` script-mode regex
  edge cases on unusual scripts (only cosmetic).

## Fidelity ledger (engine vs the Java port — verified while building units)

Exact matches (each has a dedicated smoke case):
- `SyncActionNode` RUNNING rejection (unwrapped LogicError, Java parity), condition RUNNING rejection
- Timeout/Delay/Sleep **poll-based** semantics with the deterministic 50ms virtual clock anchored at
  tick start (Timeout 300 → fails tick 6; Delay 200 → child ticks tick 4)
- Blackboard: strong typing from the FIRST typed write; `NumericCast.isSafe` (2.0 into an int entry
  OK, 1.5 throws); String values lock as `String`; createEntry strong-type conflicts (TreeNodesModel
  parity) throw on remap mismatches; `@key` → root escape; subtree remap forwarding for reads AND
  `createEntry` (Java `getEntry`/`createEntryImpl` parity)
- Script language: every number is a Double (`x := 1` declares double, Java `ExprLiteral((double)val)`
  parity), booleans are `1.0/0.0` (no `%` operator — Java has none), `&&`/`||` evaluate BOTH operands,
  Python-style chained comparisons returning `0.0/1.0` with short-circuit-after-first-fail, `:=` vs
  `=` (create-vs-existing error), enum registry via bare names (values lock as **int**),
  compound `+= -= *= /=`, `..` concat, ternary
- Subtrees: own child blackboard, explicit remaps, `{=}` alias, `_autoremap` read/write-through,
  `TreeNodesModel` mandatory port errors
- Sequence variants (restart vs memory-with-halt preserving the cursor), Parallel thresholds,
  all decorators incl. poll-based anchoring, Precondition, Loop queues, Switch2..6 string→int→real
  epsilon compare

Deliberate simplifications (do NOT claim otherwise in lessons):
1. **Virtual clock**: 1 tick = 50 ms, advanced before the tree tick. Java uses `Timer`/nanoTime —
   the *sampling* semantics (checked once per tick) match; wall-clock jitter doesn't exist by design.
2. Pre-declaration of port-typed entries happens on first pointer READ (`getInput`) and
   Java `getLockedPortContent` also covers more paths (setOutput uses plain set in both).
3. Error message strings are close-but-not-identical to Java's; the KINDS match (RuntimeError /
   LogicError / NodeExecutionError / XMLParseError).

## Curriculum plan (approved; content to write in M4)

9 units. Lesson item kinds: `reading` (blocks), `java` (code-study), `quiz`, `exercise`.
Spiral: intro with trivial simulators, revisit topics at increasing depth with harder tasks.

1. **First Tick** — what BTs are, why FRC (vs state machine/commands); NodeStatus anatomy; tick
   loop; first `<Sequence>` in visualizer. Lessons: welcome / statuses / the tick / first tree.
2. **Writing Trees in XML** — root/BehaviorTree, compact vs `<Action ID>`, Fallback + conditions,
   factory Java basics (`BehaviorTreeFactory`, `createTreeFromFile`, `tickOnce` vs
   `tickWhileRunning`). Exercises: build intake→shoot; add retry; read Java wiring.
3. **Your Own Nodes (Java)** — SyncActionNode subclass (full code), `(String, NodeConfig)` ctor,
   `providedPorts()` + `Port.list/input/output` syntax, `getInput`/`setOutput`,
   `registerNodeType`, SimpleActionNode lambda, ConditionNode rules.
4. **Data on the Blackboard** — ports, `{pointers}` vs literals, `SetBlackboard`, `<Script>`,
   type-lock (+ why it throws), safe widening, `{=}` port alias intro.
5. **RUNNING & Stateful Nodes** — StatefulActionNode, halting (`onHalted`), Sequence restart
   after FAILURE, ReactiveSequence vs Sequence, SequenceWithMemory memory.
6. **Control-Flow Mastery** — Switch, IfThenElse (non-reactive gotcha), WhileDoElse, Parallel
   thresholds, decorators deep: Timeout/Delay/Retry/Repeat/ForceSuccess/RunOnce/
   KeepRunningUntilFailure; reactive patterns for robot failure recovery.
7. **Subtrees, Remapping & Big Trees** — `<SubTree>`, `_autoremap`, `{=}`, `@root`,
   `addSubtreeRemapping`, `<TreeNodesModel>` mandatory ports, organizing big XML documents.
8. **The Scripting Language & Conditional Attributes** — full operator/precedence tour, enums,
   `_skipIf/_while/_successIf/_onSuccess/_post` practical FRC patterns.
9. **On the Robot (WPILib) + Capstone** — CommandActionNode via `WpilibNodes.registerCommandAction`,
   BehaviorTreeCommand (requirements, one tick per robotPeriodic, `_fpgaTimestamp`),
   NTBehaviorTreeLogger + dashboards, `wpilib-robot-example` wiring (includeBuild, vendordep),
   capstone: simulated autonomous (A→B path, intake, aim, 2× shoot with timeout, reactive
   game-piece abort) validated by simulator checks.

### Content data schema (must match `js/app/pages.js` + `workspace.js` + `curriculum.js`)

```js
// js/content/units/unitN.js — default export:
export default {
  id: 1, color: '#34b3a0',
  title: 'First Tick',
  tagline: 'What a behavior tree is and why FRC robots love them.',
  lessons: [
    { id: 'bt-what',            // per-unit-unique, used in URL #/1/bt-what/0
      title: 'What is a behavior tree?',
      items: [
        { kind: 'reading', title: 'Meet the tree',
          blocks: [
            { t: 'p',  md: 'Text with `inline code`, **bold**, and [links](https://…).' },
            { t: 'h',  text: 'Heading', level: 2 },
            { t: 'code', lang: 'xml' | 'java' | 'script', name: 'JAVA', code: '…' },
            { t: 'tip'|'note'|'warn', md: 'Callout text.' },
            { t: 'list', items: ['a', 'b'] },
            { t: 'table', cols: ['Node', 'Returns'], rows: [['Sequence', '…']] },
          ] },
        { kind: 'quiz', title: 'Check yourself',
          questions: [{ q: '…', options: ['x','y'], correct: 0, explain: '…', hint: '…' }] },
        { kind: 'exercise', title: 'Build something',
          workspace: {
            brief: 'Markdown brief.', tasks: ['step one'],
            startXml: '<root…>\n…</root>', maxTicks: 320,
            nodes: { Key: { type:'action'|'condition'|'stateful'|'command',
                            ports: [{dir:'input'|'output'|'inout', name, type, default}],
                            tick(ctx){…}, onStart/onRunning/onHalted(ctx){…},
                            supplier(ctx){ return {…} } } },
            enums: { RED: 0 },
            beforeTick(runner){},          // optional scheduler/robot driver
            validators: [{ label: 'Drive ran', check(api) {
              // api: status, tickIndex, simMs, blackboard/get/tryGet, snapshot, tally,
              //      statusOf(name), ticksOf(name), lastReturnOf(name), runner, tree, log
              return true || 'explanation when false';
            }}],
            hints: ['hint 1', 'hint 2'],
          } },
        { kind: 'java', title: 'Study real Java', blocks: [ {t:'code', lang:'java', name:'…', code:'…'} ] },
      ] },
  ],
};
```

### Engine facts to lean on while authoring exercises

- 1 tick = **50 simulated ms**; `Timeout msec="300"` fails on tick 6; `Delay delay_msec="200"`
  ticks its child on tick 4 (all anchored at tick-start; verified by smoke).
- Timing of a `timedCmd` mock: occupies `L+1` ticks (1 onStart + L update polls) for `L` ticks
  of its `ms` port.
- Mock robot: content supplies it inside `nodes` definitions; use `ctx.log('[Drive] moving…')`.
- Command-mock lifecycle needs a `beforeTick` that steps a module `scheduler` — several unit
  files carry the pattern verbatim; copy it or use self-ticking `stateful` mocks.
- All blackboard values visible in inspector, `@key` shows under root.
- Validators: prefer `ticksOf`/`lastReturnOf` (statuses RESET when parents complete — `statusOf`
  shows IDLE for finished children after the run; `lastReturnOf` is the reliable one). Sum tallies
  by name when leaves share a registration name.
- Chained comparisons are Python-style returning doubles; scripts never lock booleans (they have
  none); enums lock as int; script numbers lock as double (Java parity).
- `Timeout`/`Delay`/`Retry`/... all have EXACTLY ONE child — wrap pairs in a `<Sequence>`.

## Git notes

- Repo root = upstream C++ BehaviorTree.CPP checkout; **never touch paths outside `docs/learn`
  and `AGENT.md`** (except reading them). Past mistake guard: do not `git add -A`.
- **The repo moved**: GitHub now says the canonical remote is
  `https://github.com/bullbots/BehaviorTree.java.git` (the old `snowdriftdev` URL still redirects,
  but update the remote when convenient: `git remote set-url origin https://github.com/bullbots/BehaviorTree.java.git`).
  ✅ Remote already points at the canonical `bullbots` URL — nothing to do.
  First working commit landed on `master` as `eee5931` (21 files, docs/learn shell+engine+workspace).
- Expected branches/remote: user pushed from mono worktree before; ask only if push fails.
- Commit before push at the end of each working session with the pattern:
  `git add AGENT.md docs/learn && git commit -m "learn: …"` → `git push`.

## Lessons layout reference (from Codecademy, for any styling additions)

- Dark navy fixed-width (304px) left sidebar: brand (logo + "BehaviorTree.java Academy"),
  unit list with numbered circles (teal check when done), thin progress bar under each unit,
  lesson rows with hollow/teal rings; the *active* lesson expands its item kinds list
  (Reading/Quiz/Practice/Code study) with small dots.
- Main area max-width 1060px, crumb (`My Learning › Unit › Lesson › Item`), thin lesson progress
  bar, big bold H1, then content. Buttons: pink primary, ghost secondary, teal success.
- Quiz: white cards, bubble radios, teal correct banner with explanation, gentle red retry with
  hint, celebratory teal panel on completion.
- Workspace split: XML editor (dark) left; right column = controls, tree visualizer (dark),
  blackboard table, console; "Run & check" prints teal/red banners with validator lines.

## Environment

- Windows 11, PowerShell; repo: `C:\Users\conta\Projects\BehaviorTree.java`. Work has also been
  done on Linux (node v22 available) — everything so far is plain ES modules, no toolchain, so
  both shells behave identically; smoke run works anywhere node exists.
- `node` was available to planned smoke run (verify with `node -v`; if absent, prefer
  `python http.server` + browser-based `test.html` harness).
- User devices may continue work; keep everything self-contained and relative paths only.

— end of handoff v3 (all 9 units authored; 22/22 exercise solutions validated; 40/40 engine
fidelity; 85/85 routes render error-free in headless Chromium; test.html + launchers + README
shipped; only subjective UX testing remains for the user).
