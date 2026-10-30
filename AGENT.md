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
| M2 | Engine (blackboard/script/xml/nodes/factory/runner) | ✅ written, ⚠️ **smoke test written but NOT yet run** |
| M3 | Workspace (editor/visualizer/blackboard/grading) | ✅ written, ⚠️ untested |
| M4 | Content units 1–9 | ❌ **NOT written — app cannot load until `units/unit1..9.js` exist** |
| M5 | Test harness page, launcher, README, polish | ❌ |
| M6 | Verify locally, clean remove `_smoke.mjs`, commit+push | ❌ (an intermediate commit already needed — see below) |

⚠️ **Critical known gap:** `js/app/curriculum.js` imports `./units/unit1.js` … `unit9.js` which
do not exist yet, so the site is broken until content files are created (or a temporary stub
exporting `{id,title,tagline,lessons:[]}` is dropped in first).

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
js/app/curriculum.js        — imports units/unit1..9.js (FILES MISSING YET) → UNITS, getUnit, getLesson
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
_smoke.mjs                  — node smoke tests (~40 cases; run:  node docs/learn/_smoke.mjs)
                              ⚠️ contains known junk lines to remove while fixing:
                              - the `_while interrupts RUNNING` case has a stray broken
                                assignment `r.factory.virtual.Tick功课 = n2;` (delete r/r2 dup,
                                keep one), and `if (true)` style leftovers elsewhere
                              - `Delay postpones child` expectation `r.tickIndex === 4` needs
                                verification of virtual-clock semantics (50ms/tick) and possibly
                                changed to a count-based assertion instead of exact index
```

## Next steps (in order)

1. **Run the smoke test and make it pass.**
   `node docs/learn/_smoke.mjs` from repo root (or `docs/learn`). Expect several failures — fix
   engine modules, NOT the tests (except the known-junk cases listed above, which need manual
   repair first). Likely hotspots: blackboard `_resolveForWrite` chain handling, script parser
   postfix loop precedence details, Switch uses `manifestFor` (factory must get it), factory
   `manifestFor` probe instantiation for Switch (regex path already added), SubTree remap keys,
   Runner `__btLog` re-definition across runners (use configurable get/set property per run),
   `blackboard.tryGet` signature `{present,value}`, `Blackboard.entries` iteration for the
   inspector, `parseLiteral` for `{_skipping}`/`{_halting}` leftovers (delete — those don't exist
   in this port), status word normalization in `ScriptConditionNode` (`truthy` deals with texts),
   xmltext attribute regex (works with `sticky`), `AttributeContext` leftover `ledger` var in
   factory (delete unused), `NODE_KIND`, `kindFor` leftovers in factory (delete).
2. **Add missing unit stubs** so the site loads: create `js/content/units/unit1.js` … `unit9.js`.
   Then in the same pass, write the full curriculum content (schema below).
   Suggested approach: author unit files in pairs with a matching `problems` review pass.
3. Wire content pages: verify router/sidebar/quiz/workspaces load in a browser:
   `python -m http.server 8420` inside `docs/learn` → `http://localhost:8420/`.
   (On Windows PowerShell: `python -m http.server 8420` or `py -m http.server`.)
   Test clicking through every lesson; fix runtime errors (likely: pages.js nav function
   edge cases noted below).
4. Add `docs/learn/start.cmd` + `start.sh` (serve + open browser at chosen port, e.g. 8420) and
   `docs/learn/README.md` (what it is, how to run, curriculum map, credit note: content teaches
   `BehaviorTree.java`, the WPILib port of BehaviorTree.CPP).
5. Optional test-harness page `docs/learn/test.html` that runs the engine fidelity cases in
   browser and shows pass/fail (reuse smoke cases) — nice for regression checking in repo CI toys.
6. Delete `_smoke.mjs` (or move its cases into a permanent `js/engine/_tests.mjs` page-based
   harness; Codacademy users never see it). Prefer keeping a permanent in-site `test.html`.
7. Update this file (status + remaining), then **git commit with only the new files**:
   - `git add AGENT.md docs/learn` (+ nothing else; check `git status` to avoid upstream files)
   - commit message e.g. `docs/learn: BehaviorTree.java Academy — self-contained local course`
   - `git push` (ask the user which remote/branch if there are multiple or protected refs).
8. Final sweep before declaring done: try every unit clickable path, ensure no console errors,
   no `file://` assumptions (all paths relative), dark-mode text contrast, and that exercises
   actually annotate passing validators.

## Known issues / be-suspicious list (from the first draft pass)

- `pages.js` — `findRel` wrap logic; ensure prev/next cross-lesson navigation works and that the
  final "Unit finish →" button is only enabled when sensible. `refreshRoute` was replaced with
  direct `renderSidebar` call; verify no double-render loops. UnitComplete overlay is
  `renderMain.appendChild` hack — acceptable but fix id collision if it re-appends.
- `store.js` — imports `getUnit` but may no longer use it (delete import); `lastRoute.get`
  uses `getUnit(u.unit)` — verify behavior when unit is null.
- `workspace.js` — `runBtn` pause toggle duplicates `startLoopManual`; the "⏸ Pause" reset of
  label after stopLoop in `startLoop` never happens (stopLoop leaves the pause label) — add
  label restore in stopLoop. `renderTree` uses `runner._lastTouchedUid` which is never set —
  either wire per-tick "touched" uid (nodes expose nodeUid on executeTick) or drop the gold flash.
- `nodes.js` — `NodeExecutionError` name may shadow; `ctxOf().log` uses global hook (Runner
  installs `__btLog` via defineProperty — make per-runner or id-unique to avoid stale runner logs).
- `factory.js` — remove unused `const m`, `NODE_KIND`, `kindFor`, unused `model` var leftovers;
  confirm `manifestFor` instantiates probes safely for all builtins (status etc).
- `blackboard.js` — entry type inference sets `e.type` but never sets `e.locked = true` after
  inference; decide: (Java) locks on first *typed* write → after inference set `locked = true`
  (so later mismatched writes throw). Currently only `createEntry` sets locked. Update `apply`
  accordingly and re-run smoke `type lock throws`.
- `highlight.js` — script highlight regex may mis-handle `:=` vs `:` and `..`; check rendering
  of `<Script code="..."/>` inside XML (strings contain single quotes — fine).
- Virtual `command` nodes: CommandActionLike polls `command._scheduled`; content schedulers must
  keep commands advancing via `beforeTick: (runner) => ...` (documented pattern for exercises:
  content defines `beforeTick` that advances its own mock commands; supplier sets `_scheduled=false`
  when the command finishes). No central scheduler exists — that's by design (content-side),
  document it in unit 9 content.
- `parseLiteral` treats `status` type inputs loosely; fine for sim.

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
- Mock robot: content supplies it inside `nodes` definitions; use `ctx.log('[Drive] moving…')`.
- All blackboard values visible in inspector, `@key` shows under root.
- Keep exercise node registries small and readable; prefer `type:'command'` for `Intake`-like
  mocks so lessons 9 can teach the identical `CommandActionNode` pattern.
- Validators: prefer `ticksOf('Name')` over fragile order assertions.

## Git notes

- Repo root = upstream C++ BehaviorTree.CPP checkout; **never touch paths outside `docs/learn`
  and `AGENT.md`** (except reading them). Past mistake guard: do not `git add -A`.
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

- Windows 11, PowerShell; repo: `C:\Users\conta\Projects\BehaviorTree.java`.
- `node` was available to planned smoke run (verify with `node -v`; if absent, prefer
  `python http.server` + browser-based `test.html` harness).
- User devices may continue work; keep everything self-contained and relative paths only.

— end of handoff v1 (written after M1–M3 first pass, before first smoke run and content authoring).
