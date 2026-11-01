// UNIT 6 — Control-Flow Mastery. Switch/IfThenElse/WhileDoElse, Parallel thresholds, the whole
// decorator toolbox, and reactive failure-recovery patterns for FRC robots.
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };
const scheduler = (() => {
  let last = null; const cmds = [];
  return {
    add(c) { cmds.push(c); },
    step(runner) {
      if (runner !== last) { last = runner; cmds.length = 0; }
      for (let i = cmds.length - 1; i >= 0; i--) {
        const c = cmds[i];
        c.update && c.update();
        if (!c._scheduled) cmds.splice(i, 1);
      }
    },
  };
})();
const timedCmd = (defMs, name = 'ms') => (ctx) => {
  const c = { _scheduled: true, left: Math.ceil(msOf(ctx, name, defMs) / 50) };
  c.update = () => { c.left -= 1; if (c.left <= 0) c._scheduled = false; };
  scheduler.add(c); return c;
};
export default {
  id: 6,
  color: '#f65a5b',
  title: 'Control-Flow Mastery',
  tagline: 'Switches, parallels, and decorators — the full built-in toolbox.',
  lessons: [
    {
      id: 'switch-if-while',
      title: 'Switch, IfThenElse, WhileDoElse',
      items: [
        {
          kind: 'reading',
          title: 'Three ways to dispatch',
          blocks: [
            { t: 'code', lang: 'xml', name: 'XML', file: 'dispatch.xml', code: `<Switch3 name="AutoPicker" variable="{autoColor}" case_1="RED" case_2="BLUE" case_3="CYAN">
  <Sequence name="RedAutos"/>
  <Sequence name="BlueAutos"/>
  <Sequence name="CyanAutos"/>
  <PlanB name="Default"/>   <!-- always the LAST child: the default case -->
</Switch3>` },
            { t: 'list', items: [
              '`Switch2` … `Switch6` — compare the `variable` port against `case_N` (string-or-number compare with the same epsilon logic as the script engine). Last child is always the default.',
              '`IfThenElse` — 2 or 3 children `[cond, then, else?]`. **The condition changes the tick only ONCE**: over 2 children, a FAILED condition returns FAILURE each tick it re-asks... which is exactly why non-reactive Gotcha: in a plain Sequence, the whole IfThenElse lives only in the tick it was entered.',
              '`WhileDoElse` — 2 children `[while-condition, do]` (+ optional `[?]  else` branch that runs whenever the while goes false). It is reactive by design: the condition is re-asked EVERY tick while `do` is RUNNING.',
            ] },
            { t: 'code', lang: 'xml', name: 'XML', file: 'while-do-else.xml', code: `<WhileDoElse>
  <BallLoaded/>
  <Shooting ms="250"/>        <!-- loops/keeps shooting while NOTE actually loaded -->
</WhileDoElse>` },
            { t: 'warn', md: '`IfThenElse` in BehaviorTree.java is **NOT** reactive (upstream BT.CPP the same). If you need a fresh look at the condition while the branch runs, pick WhileDoElse, or make the condition a child of a ReactiveSequence wrapping sequence branches yourself.' },
            { t: 'p', md: 'In the tool phrasing: `SwitchN.variable` is typed "string" from the XML perspective, but `42`-style cases are converted (string, then int, then real-with-epsilon) — upstream\'s `checkStringEquality` behavior, which the simulator mirrors.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Pick the auto by alliance color',
          workspace: {
            brief: 'The blackboard starts with `alliance` already set (the harness does that). Build a Switch that runs `Shoot` in RED mode, `IntakeThenShoot` for BLUE, and falls through PlanB in anything else.',
            tasks: [
              '`<Switch2 ...>` with `variable="{alliance}"`, `case_1="RED"`, `case_2="BLUE"`',
              'RED → <Shoot/>; BLUE → <Sequence><Intake/><Shoot/></Sequence>',
              'Third child (default) is <DoNothing/> — must never tick',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">

    <!-- Switch2: RED shoots, BLUE intake+shoot, default does nothing -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Switch2 name="AutoPicker" variable="{alliance}" case_1="RED" case_2="BLUE">
      <Shoot name="RedShoot"/>
      <Sequence>
        <Intake ms="250"/>
        <Shoot name="BlueShoot"/>
      </Sequence>
      <DoNothing/>
    </Switch2>
  </BehaviorTree>
</root>`,
            maxTicks: 80,
            nodes: {
              Shoot: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '250' }], supplier: timedCmd(250) },
              Intake: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '400' }], supplier: timedCmd(400) },
              DoNothing: { type: 'action', tick: () => 'SUCCESS' },
            },
            beforeTick: (runner) => {
              scheduler.step(runner);
              if (!runner.blackboard.tryGet('alliance').present) runner.blackboard.set('alliance', 'BLUE');
            },
            validators: [
              { label: 'BLUE branch completed intake + shoot', check: (api) => (api.lastReturnOf('Intake') === 'SUCCESS' && api.lastReturnOf('BlueShoot') === 'SUCCESS') || 'the BLUE branch did not complete' },
              { label: 'RED branch never ticked', check: (api) => api.ticksOf('RedShoot') === 0 || 'the RED branch ran — alliance is BLUE' },
              { label: 'the default case never ticked', check: (api) => api.ticksOf('DoNothing') === 0 || 'DoNothing should be unreachable with alliance=BLUE' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'SwitchN: children count = N + 1; the extra last one is the default case.',
              'BLUE plan = a nested Sequence — <Sequence><Intake/><Shoot/></Sequence>.',
              'Case comparison is lenient: "42" cases match integer 42 the same as upstream.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'During a RUNNING `Shooting` child, if WhileDoElse\'s `while`-condition goes FAILURE, what does the running branch get?',
              options: [
                'Nothing special — it finishes',
                'A halt (onHalted), then the else branch runs each tick (or FAILURE with no else)',
                'An automatic SUCCESS',
              ],
              correct: 1,
              explain: 'WhileDoElse holds the condition alive: FAILURE while the do-branch is running halts it (onHalted for stateful actions) and switches to the else child, or returns FAILURE with two children.',
              hint: 'Think about the robot mid-shoot when the note statistic is suddenly no longer loaded.',
            },
          ],
        },
      ],
    },
    {
      id: 'parallel',
      title: 'Parallel: many mechanisms, one tick',
      items: [
        {
          kind: 'reading',
          title: 'success_count / failure_count',
          blocks: [
            { t: 'code', lang: 'xml', name: 'XML', file: 'parallel.xml', code: `<Parallel success_count="2" failure_count="1">
  <ReadyToShoot/>       <!-- condition, re-ticked each pass -->
  <SpinUp ms="300"/>
  <AlignToDept ms="200"/>
</Parallel>` },
            { t: 'p', md: 'A `Parallel` ticks **every child every tick** (skipping completed ones). The pair of thresholds decides the outcome:' },
            { t: 'table', cols: ['Port', 'Default', 'Meaning'], rows: [
              ['`success_count`', '-1', 'how many children must SUCCEED to end the Parallel SUCCESSfully. Negative means "all children except N"'],
              ['`failure_count`', '1', 'how many children failing ends the whole Parallel with FAILURE'],
            ] },
            { t: 'list', items: [
              'Every tick: for each incomplete child — SUCCESS/FAILURE add to counters, RUNNING stays open. Thresholds are checked after each child (an early full count can stop mid-row).',
              '`ParallelAll` is the degenerate version: succeed when ALL succeed, fail after max_failures (=1 by default).',
              'Parallel is the correct FRC idiom for *decoupled mechanisms*: a shooter can be spinning while the drivetrain segues — each child owns its own statefulness.',
            ] },
            { t: 'warn', md: 'Children of a Parallel that have *completed* are skipped on later ticks (via `completed` set). CONDITIONS re-run by construction — use Parallel like "Analyse then decide", but remember its FAILURE semantics: one failed condition + default failure_count kills the other work.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Spin while driving',
          workspace: {
            brief: 'Spin the flywheel (`SpinUp`, 8 ticks) and drive (`Drive`, 10 ticks) **at the same time** with `Parallel success_count="2"`: shoot as soon as BOTH are done.',
            tasks: [
              'Both children in one Parallel',
              'success_count="2" (or leave default? no — the default is -1 = all, it works too, but be explicit)',
              'The tree ends SUCCESS no later than tick 12',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">

    <!-- Parallel: SpinUp + Drive -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Parallel success_count="2" failure_count="1">
      <SpinUp ms="400"/>
      <Drive ms="500"/>
    </Parallel>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              SpinUp: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '400' }], supplier: timedCmd(400) },
              Drive: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '500' }], supplier: timedCmd(500) },
            },
            beforeTick: (runner) => scheduler.step(runner),
            validators: [
              { label: 'Both branches ticked in the same run', check: (api) => (api.lastReturnOf('SpinUp') === 'SUCCESS' && api.lastReturnOf('Drive') === 'SUCCESS') || 'both children must finish' },
              { label: 'runtime overlapped (Drive done by tick 12)', check: (api) => api.tickIndex <= 12 || `run took ${api.tickIndex} ticks — they ran se-quentially, check XML` },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'Parallel ticks every child every tick — total run time is the LONGEST child, not the sum.',
              'success_count can be omitted (defaults to -1 → all children). Being explicit is clearer.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'In Parallel with 3 children, success_count="2", failure_count="1": child A succeeds, child B fails. Outcome?',
              options: [
                'RUNNING until more children succeed',
                'FAILURE — one failure already reaches failure_count 1, even though A succeeded',
                'SUCCESS — A saturated success_count 2/3 with the third pending',
              ],
              correct: 1,
              explain: 'failure_count wins the instant it is met (it is checked first after the failing child). Defaults exist but you usually spell both thresholds explicitly on the robot.',
              hint: 'Check the checklist the engine runs after each child: successes-then-failures.',
            },
          ],
        },
      ],
    },
    {
      id: 'decorators',
      title: 'Decorator toolbox: timeout, retry, repeat',
      items: [
        {
          kind: 'reading',
          title: 'The eight decorators worth memorizing',
          blocks: [
            { t: 'table', cols: ['Decorator', 'Do', 'FRC cents'], rows: [
              ['`Timeout msec="400"`', 'fails a child that is still RUNNING past the ms deadline (poll-based, ms per tick = 50)', 'protect the auto period from hanging branches'],
              ['`Delay delay_msec="200"`', 'holds the child unticked until ms have first elapsed', 'sequence spacing without extra Script timing'],
              ['`RetryUntilSuccessful num_attempts="3"` (alias `Retry`)', 're-ticks the child after each FAILURE', 'a janky mechanism gets 2 more chances; -1 = forever'],
              ['`Repeat num_cycles="4"`', 're-runs the (successful!) child N times', 'periodic sensor polling / shoot bursts'],
              ['`ForceSuccess`/`ForceFailure`', 'rewrites the child\'s final FAILURE→SUCCESS / SUCCESS→FAILURE', 'audit-shield a best-effort arm'],
              ['`RunOnce then_skip="true"`', 'SUCCESS on tick 1, SKIPPED after', 'one-time cleanup blocks'],
              ['`KeepRunningUntilFailure`', 'converts SUCCESS → RUNNING', 'continuous aim tracking: "stay alive unless the plan broke"'],
              ['`Inverter`', 'flips SUCCESS/FAILURE', 'reuse a condition with the other polarity'],
            ] },
            { t: 'p', md: 'Two facts that catch people (all java/behaviortree-core-verified):' },
            { t: 'list', items: [
              '**Timeout/Delay/Sleep are poll-based in this port** — no background timer thread; the deadline is checked once per tick. With the simulator\'s deterministic virtual clock (1 tick = 50 ms starting at tick start), `Timeout msec="300"` fails exactly on tick 6.' +
              ' On real hardware the same code uses Timer.getFPGATimestamp through the Clock — the sampling-once-per-tick behavior is identical, so the semantics transfer 1:1.',
              '**Retry vs Repeat is the pivot**: `Retry` re-ticks after FAILURE (and STOPS on SUCCESS); `Repeat` re-runs after SUCCESS (and stops on FAILURE). Swapping them silently inverts your recovery logic.',
            ] },
            { t: 'code', lang: 'xml', name: 'XML', file: 'shielded-shoot.xml', code: '<Timeout msec="2000">\n  <Shoot ms="1500"/>\n</Timeout>' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Give the shooter a deadline',
          workspace: {
            brief: 'A misbehaving `Shoot` command (2000 ms sim-nature below means it would hang forever in a tick-limited harness). Wrap it in a `Timeout msec="600"` so the timing cut-out FAILS the branch — the auto can then recover (that recovery comes in the next lesson).',
            tasks: [
              'Wrap <Shoot/> in <Timeout msec="600"/>',
              'Tree must end FAILURE (before tick 15) — a hanging child shielded by a deadline',
              'But the child must have STARTED (onStart happened at least once)',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Shield">
  <BehaviorTree ID="Shield">
    <Shoot/>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Shield">
  <BehaviorTree ID="Shield">
    <Timeout msec="600">
      <Shoot/>
    </Timeout>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              Shoot: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '2000' }], supplier: timedCmd(2000) },
            },
            beforeTick: (runner) => scheduler.step(runner),
            validators: [
              { label: 'Shoot started but never finished', check: (api) => (api.ticksOf('Shoot') >= 1 && api.lastReturnOf('Shoot') !== 'SUCCESS') || 'Shoot must have started and then be halted by the timeout' },
              { label: 'tree ended FAILURE', check: (api) => api.status === 'FAILURE' || `tree ended ${api.status}` },
              { label: 'before tick 15', check: (api) => api.tickIndex <= 15 || `the branch ran ${api.tickIndex} ticks — timeout too loose?` },
            ],
            hints: [
              '600 ms = the deadline reached on tick 12 with 50 ms simulated ticks.',
              'Timeout fails the branch when the child is STILL RUNNING at the deadline — the child gets haltChild → command cancel.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Which decorator would you pick to make a leaf "keep aiming" — i.e. keep its branch alive while it succeeds?',
              options: ['Retry', 'KeepRunningUntilFailure', 'Repeat'],
              correct: 1,
              explain: 'KeepRunningUntilFailure turns a SUCCESS into RUNNING, so the aim keeps re-running until it fails. Retry re-ticks on FAILURE — you\'d need the aim to fail first.',
              hint: 'Look at the mapping table: SUCCESS → RUNNING.',
            },
            {
              q: 'A `Delay delay_msec="175"` inside a sim tick loop: at which tick does the child first execute?',
              options: ['tick 3', 'tick 4', 'tick 5'],
              correct: 1,
              explain: 'The clock anchors at the tick start: 175 ms of simulated time is fully elapsed on tick 4 (4 × 50 = 200 ≥ 175). This is the sim\'s documented contract, mirrored to Java timing via the clock.',
              hint: 'It is the tick whose START sweep reaches 175 ms.',
            },
          ],
        },
      ],
    },
    {
      id: 'recovery',
      title: 'Reactive recovery patterns',
      items: [
        {
          kind: 'reading',
          title: 'The pattern: cheap sensor first, mechanism second, every tick',
          blocks: [
            { t: 'code', lang: 'xml', name: 'XML', file: 'auto-recovery.xml', code: `<!-- keep the intake running IFF the intake has work to do;
     otherwise stop *within the same tick* and retry later -->
<ReactiveSequence>
  <IntakeHungry/>
  <Intake ms="500"/>
</ReactiveSequence>` },
            { t: 'p', md: 'When a condition in a ReactiveSequence flips to FAILURE while the running mechanism is mid-action, the mechanism receives an **immediate halt** and the whole sequence returns FAILURE — new plans (Retry, Fallback, whatever is above) react the same tick. rollout got you: this is BT.CPP\'s killer feature for FRC auto resiliency.' },
            { t: 'tip', md: 'Compose recovery in layers: Retry for "the world jitters", Timeout for "this branch hung", Reactive guards for "conditions changed". Each layer protects a different failure geometry.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'layered.xml', code: `<RetryUntilSuccessful num_attempts="3">
  <Timeout msec="800">
    <ReactiveSequence>
      <Aligned/>
      <Shoot ms="400"/>
    </ReactiveSequence>
  </Timeout>
</RetryUntilSuccessful>` },
          ],
        },
        {
          kind: 'exercise',
          title: 'Layered protection: jam-then-recover',
          workspace: {
            brief: '`Collect` jams during tick 3 (it will go FAILURE) — the auto must **retry up to 3 attempts**. Add a `Retry num_attempts="3"` around Collect *and* verify the Retry falls back out — Wash the jam flag mid-run comes from the harness, exactly like the robot: the Retry gets attempts 2 and 3.',
            tasks: [
              '<Retry num_attempts="3"> around <Collect/>',
              'The run must finish with Collect SUCCESS after 3 attempts',
              'Tree SUCCESS by tick 20',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Jam">
  <BehaviorTree ID="Jam">
    <Sequence>
      <Arm ms="100"/>
      <!-- Collect retries here -->
    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Jam">
  <BehaviorTree ID="Jam">
    <Sequence>
      <Arm ms="100"/>
      <Retry num_attempts="3">
        <Collect/>
      </Retry>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              Arm: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '100' }], supplier: timedCmd(100) },
              Collect: {
                type: 'stateful',
                onStart: (ctx) => {
                  const c = ctx.blackboard.tryGet('attempts');
                  const n = (c.present ? c.value : 0) + 1;
                  ctx.blackboard.set('attempts', n);
                  return n < 3 ? 'FAILURE' : 'SUCCESS';
                },
              },
            },
            beforeTick: (runner) => scheduler.step(runner),
            validators: [
              { label: 'Collect attempted 3 times (2 jams + success)', check: (api) => api.get('attempts') === 3 || `attempts = ${api.get('attempts')}` },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
              { label: 'by tick 20', check: (api) => api.tickIndex <= 20 || `ended on tick ${api.tickIndex}` },
            ],
            hints: [
              'Retry internally re-runs the child as soon as it sees FAILURE, up to (but INCLUDING) num_attempts rounds.',
              'Collect is a stateful mock modeled on "2 jams then it clears"; leave maxTicks at 40.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'ReactiveSequence(Aligned, Spin) with Spin RUNNING for 6 ticks; Aligned goes FAILURE on tick 4. What does the harness tree do on tick 4?',
              options: [
                'Spin keeps running; nothing changes',
                'Aligned fails → Spin halted immediately → ReactiveSequence returns FAILURE the same tick',
                'The tree halts everything and waits',
              ],
              correct: 1,
              explain: 'This is the entire point of reactive guarding: cheap sensors get re-asked while mechanisms run, and RUNNING leaves receive their halt the same tick — no inertia, no "finish the swing first" delay.',
              hint: 'React means same-tick reaction.',
            },
          ],
        },
      ],
    },
  ],
};
