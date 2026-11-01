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
| M1 | Shell (router/sidebar/theme/store/lesson+quiz renderers) | ✅ written, ⚠️ untested in browser |
| M2 | Engine (blackboard/script/xml/nodes/factory/runner) | ✅ **DONE — smoke green: 37/37 via `node docs/learn/_smoke.mjs`** |
| M3 | Workspace (editor/visualizer/blackboard/grading) | ✅ written, ⚠️ untested |
| M4 | Content units 1–9 | ⚠️ **stubs only**: `js/app/units/unit1..9.js` exist with real titles/taglines but EMPTY lessons — site loads its skeleton, no lessons yet. Full content NOT written. |
| M5 | Test harness page, launcher, README, polish | ❌ |
| M6 | Commit+push at session end; final sweep | 🔁 ongoing (see Git notes) |

✅ **Stale "critical gap" resolved:** unit stub files now exist, so `js/app/curriculum.js` no longer
crashes on import. Route guard added in `router.js` (a lesson with 0 items falls back to home instead
of crashing on `items[-1]`). Keep that in mind while authoring: **never ship a lesson with zero
items** in the final build.

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
js/app/curriculum.js        — imports units/unit1..9.js → UNITS, getUnit, getLesson
                              (stubs exist with empty lessons, real titles/taglines)
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
_smoke.mjs                  — engine smoke tests, 37/37 passing (run: node docs/learn/_smoke.mjs)
                              junk/repairable cases all fixed this session; also covers Sleep/anchoring,
                              command round-trip w/ beforeTick scheduler, DOCTYPE rejection, @key escape,
                              SyncAction RUNNING rejection, autoremap + explicit SubTree remaps.
                              ⚠️ TEMPORARY: becomes an in-site test.html harness before commit-out.
```

## Next steps (in order)

1. ~~Run the smoke test and make it pass.~~ ✅ **All 37 tests pass** (`node docs/learn/_smoke.mjs`).
   Engine fixes made during the first pass (all verified against the Java sources):
   - `script.js`: `Math.ulp` → `Number.EPSILON`; **Python-style chained comparisons** implemented
     as dedicated `cmp`/`cmpx` AST nodes (middle operand's VALUE is reused, `2<1<3`=false);
     bare enum names now resolve when the blackboard lookup fails (`color := RED`).
   - `nodes.js`: `Math.ulp` removed from Switch's `checkStringEquality`; Timeout/Delay/Sleep
     anchor their deadline at **tick start** (`simClock.startOfTick()`, new clock API) so
     `Timeout msec="300"` fails on tick 6 and `Delay delay_msec="200"` ticks the child on
     tick 4, as the curriculum facts claim; `SyncActionNode`/`ConditionNodeUser`/`ActionNodeUser`
     do the RUNNING check **outside** the wrapped tick (Java parity → unwrapped `LogicError`),
     so exercise `'action'` defs must not return RUNNING — use `'stateful'`/`'command'`.
   - `factory.js`: `querySelector` call on the custom XML tree replaced by `hasDescendant`
     helper; **SubTree no longer treated as a decorator requiring XML children** (its child is
     the referenced tree body, built in `instantiateSubtree`).
   - `blackboard.js`: entries now **lock on the first typed write** (Java `set` parity) and a
     `double` written to an `int` entry **widens the entry to double** instead of throwing —
     ⚠️ deliberate deviation: real Java throws LogicError for `1.5` into a declared int entry.
     See "Sim-only deviations" below before authoring unit 4. Auto-remap **writes now forward
     creation to the parent blackboard** (Java `createEntryImpl` parity).
   - `_smoke.mjs`: junk cases repaired as planned (`_while` dummy runners deleted, Delay index
     assertion kept and now correct = tick 4), plus genuinely broken expectations fixed
     (two-siblings-under-`<BehaviorTree>` XML wrapped in `<Sequence>`; `DefNode`→`DEF`;
     `<Slow sec="1">` port typo; `ScriptCondition` now asserts `done==4` + FAILURE;
     `Precondition` uses the real builtin; stateful tick counter uses `tryGet`). Added new
     cases: Sleep/anchoring, command node round-trip (beforeTick scheduler pattern), DOCTYPE
     rejection, `@key` root escape, Sync RUNNING rejection, autoremap.
2. **Author the full unit content.** Files live at `js/app/units/unitN.js` (NOT
   `js/content/…` as an earlier note said — the import in curriculum.js is the source of truth).
   Write them one unit at a time, greppable through the schema at the bottom of this file,
   and re-run a browser pass after every 2–3 units. Never leave a lesson with zero `items`
   while committing (router now tolerates it, but the UI shows nothing).
3. Wire content pages: verify router/sidebar/quiz/workspaces load in a browser:
   `python -m http.server 8420` inside `docs/learn` → `http://localhost:8420/`.
   Click through every lesson; fix runtime errors (pages.js nav edge cases still unverified).
4. Add `docs/learn/start.cmd` + `start.sh` (serve + open browser at chosen port, e.g. 8420) and
   `docs/learn/README.md` (what it is, how to run, curriculum map, credit note: content teaches
   `BehaviorTree.java`, the WPILib port of BehaviorTree.CPP).
5. Turn `_smoke.mjs` into a permanent in-site harness: copy the cases into a page wired to
   `docs/learn/test.html` (no DOM dependency in the engine — all cases are pure node logic, so
   they run in the browser too). Users never see it; it doubles as a regression tool after
   engine tweaks made while authoring exercises.
6. Final sweep before declaring done: try every unit clickable path, ensure no console errors,
   no `file://` assumptions (all paths relative), dark-mode text contrast, exercises annotate
   passing validators. Delete `_smoke.mjs` **only after** step 5 is committed.
7. **git commit with only the new files** at every session end (had one landed this session —
   see Git notes), then `git push`.

## Known issues / be-suspicious list (from the first draft pass)

Resolved this session (do not re-litigate unless a symptom reappears): factory leftover
`NODE_KIND`/`kindFor` concerns (checked — not present), blackboard lock semantics (now locked on
first typed write, see "Engine fixes" above), SubTree decorator misclassification, Switch
`manifestFor` wiring (works), `_while-interrupts` junk test, `Delay` stake (anchored; tick 4),
Runner `__btLog` — verified fine via configurable defineProperty per Runner (still stale if two
Runners coexist in the same page; keep in mind for test.html).

Still open:
- `pages.js` — `findRel` wrap logic; ensure prev/next cross-lesson navigation works and that the
  final "Unit finish →" button is only enabled when sensible. `refreshRoute` was replaced with
  direct `renderSidebar` call; verify no double-render loops. UnitComplete overlay is
  `renderMain.appendChild` hack — acceptable but fix id collision if it re-appends.
- `workspace.js` — `runBtn` pause toggle duplicates `startLoopManual`; the "⏸ Pause" reset of
  label after stopLoop in `startLoop` never happens (stopLoop leaves the pause label) — add
  label restore in stopLoop. `renderTree` uses `runner._lastTouchedUid` which is never set —
  either wire per-tick "touched" uid (nodes expose nodeUid on executeTick) or drop the gold flash.
- `store.js` — verified: `getUnit` IS used by `lastRoute.get`; no dead import. Behavior when unit
  is null is guarded (`u || state.data.last.unit === null`). OK.
- `highlight.js` — script highlight regex may mis-handle `:=` vs `:` and `..`; check rendering
  of `<Script code="..."/>` inside XML (strings contain single quotes — fine).
- Virtual `command` nodes: CommandActionLike polls `command._scheduled`; content schedulers must
  keep commands advancing via `beforeTick: (runner) => ...` (verified pattern, see smoke's
  `command node round-trip`). No central scheduler exists — that's by design (content-side),
  document it in unit 9 content.
- `parseLiteral` treats `status` type inputs loosely; fine for sim.

## Sim-only deviations (document for lessons before claiming "exactly like Java")

1. **Virtual clock**: 1 tick = 50 ms, advanced once per Runner tick BEFORE the tree ticks.
   Polled Timeout/Delay/Sleep anchor deadlines at `simClock.startOfTick()`, so elapsed time is a
   whole number of ticks: Timeout 300 → FAILURE on tick 6; Delay 200 → child ticks on tick 4.
2. **Blackboard widening on write**: writing 1.5 into an entry first written as `1` widens the
   entry's type to double. In Java/behaviortree-core this throws (NumericCast.isSafe(int, 1.5) is
   false). Unit 4 should teach "int entries keep their integer-ness; store doubles from the
   start" and - either change the sim to throw for fidelity, or word the lesson as the sim
   behaves. Decision needed from user before finalizing unit 4.
3. **Sync RUNNING check**: virtual `'action'` defs reject RUNNING (Java parity with
   SyncActionNode) with an unwrapped LogicError — steer exercise authors to `'stateful'`.

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

- 1 tick = **50 simulated ms** (`simClock`); `Timeout msec="300"` fails on tick 6 (300ms); visual
  clock label shows `robot @ X.Xs`. `Run` mode ticks on an interval (default 220ms real time).
- `Delay delay_msec="200"` ticks its child exactly on tick 4 (anchored at tick-start; verified
  by smoke). `Sleep msec="500"` → SUCCESS the first tick where elapsed ≥ 500ms.
- Mock robot: content supplies it inside `nodes` definitions; use `ctx.log('[Drive] moving…')`.
- All blackboard values visible in inspector, `@key` shows under root.
- Keep exercise node registries small and readable; prefer `type:'command'` for `Intake`-like
  mocks so lessons 9 can teach the identical `CommandActionNode` pattern.
- Validators: prefer `ticksOf('Name')` over fragile order assertions.
- Chained comparisons are Python-style in the sim script engine (`2<1<3` = false); enums resolve
  as bare names; `@key` writes go to the ROOT blackboard (all verified by smoke cases).

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

— end of handoff v2 (smoke green · engine fidelity fixes landed · unit stubs in place ·
full content authoring is the next session's main task).
