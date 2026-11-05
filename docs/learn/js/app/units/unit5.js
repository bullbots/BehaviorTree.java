// UNIT 5 — RUNNING & Stateful Nodes. StatefulActionNode (onStart/onRunning/onHalted), halting,
// Sequence restart-on-FAILURE vs ReactiveSequence vs SequenceWithMemory memory.
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };
export default {
  id: 5,
  color: '#34b3a0',
  title: 'RUNNING & Stateful Nodes',
  tagline: 'Teach nodes to hold state across ticks — and to be halted politely.',
  lessons: [
    {
      id: 'stateful-nodes',
      title: 'StatefulActionNode: three hooks',
      items: [
        {
          kind: 'java',
          title: 'Code study: the StatefulActionNode contract',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'SpinFlywheelNode.java', code: `public class SpinFlywheelNode extends StatefulActionNode
{
  private double targetRpm;

  public SpinFlywheelNode(String name, NodeConfig config) { super(name, config); }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Double.class, "rpm", 3000.0, "target flywheel speed"));
  }

  @Override
  protected NodeStatus onStart()
  {
    targetRpm = getInput("rpm", Double.class);
    shooterSubsystem.spinTo(targetRpm);
    return NodeStatus.RUNNING;                        // "this will take a few ticks"
  }

  @Override
  protected NodeStatus onRunning()
  {
    double now = shooterSubsystem.rpm();
    return now < 0.95 * targetRpm ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
  }

  @Override
  protected void onHalted()
  {
    shooterSubsystem.stop();                          // crash-safe: always defined
  }
}` },
            { t: 'p', md: 'The stateful contract, straight from the Java base class:' },
            { t: 'list', items: [
              'First tick (status IDLE) → `onStart()`. May return RUNNING, SUCCESS, or FAILURE — **never IDLE**.',
              'Subsequent ticks while RUNNING → `onRunning()`. Return RUNNING to keep the tick alive, or a finished status to end.',
              'When the node is halted → `halt()` → if the node was RUNNING, `onHalted()` runs. No return value — its only job is to make the robot SAFE; the wrapper resets the node\'s status afterwards.',
            ] },
            { t: 'warn', md: 'Reset state in `onStart`, never rely on the constructor — a tree restart (a tick after a FAILURE, or a fresh auto) re-ticks the SAME node instance without constructing a new one.' },
            { t: 'note', md: 'You will meet this shape again in the WPILib layer: `CommandActionNode` (unit 9) is a StatefulActionNode whose "state" is the live Command handle.' },
          ],
        },
        {
          kind: 'exercise',
          title: "Step through onStart → onRunning → SUCCESS",
          workspace: {
            brief: 'The sim carries `SpinFlywheel` exactly as the Java class above. Step the first ~8 ticks and use the tree view to catch the status transitions. Then let the grader verify the sequence of states.',
            tasks: [
              'Run the default tree — it is already correct',
              'Note how the blackboard `speed` climbs while the node stays RUNNING',
              'Run & check',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Spinup">
  <BehaviorTree ID="Spinup">
    <SpinFlywheel rpm="120"/>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Spinup">
  <BehaviorTree ID="Spinup">
    <SpinFlywheel rpm="120"/>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              SpinFlywheel: {
                type: 'stateful',
                ports: [{ dir: 'input', name: 'rpm', type: 'double' }],
                onStart: (ctx) => { ctx.blackboard.set('speed', 0); ctx.log('[SpinFlywheel] onStart'); return 'RUNNING'; },
                onRunning: (ctx) => {
                  const speed = ctx.blackboard.get('speed','double');
                  ctx.blackboard.set('speed', speed + 25);
                  if (speed + 25 < (ctx.getInput('rpm','double'))) { ctx.log('[SpinFlywheel] ' + (speed+25)); return 'RUNNING'; }
                  ctx.log('[SpinFlywheel] at speed ' + (speed+25));
                  return 'SUCCESS';
                },
                onHalted: (ctx) => ctx.log('[SpinFlywheel] onHalted → stop'),
              },
            },
            validators: [
              { label: 'SpinFlywheel ran several ticks (≥ 5)', check: (api) => api.ticksOf('SpinFlywheel') >= 5 || 'SpinFlywheel should run several ticks' },
              { label: 'final speed ≥ 125 rpm', check: (api) => api.get('speed') >= 125 || `speed = ${api.get('speed')}` },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'Each onRunning bumps the speed 25 rpm and only finishes when at or above the target.',
              'RUNNING states in the visualizer are blue; the blackboard inspector below shows `speed` climbing.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'onStart() returns RUNNING. onRunning() will first be called when?',
              options: ['Same tick', 'Next tick — start and run are separate states', 'Never unless the tree halts'],
              correct: 1,
              explain: 'One tick produces ONE callback. When onStart returns RUNNING, the next tick of this node runs onRunning — start/finish are never mixed inside a single tick.',
              hint: 'Base class tick() dispatches on the CURRENT status before your hooks run.',
            },
          ],
        },
      ],
    },
    {
      id: 'halting',
      title: 'Halting: stopping a branch mid-motion',
      items: [
        {
          kind: 'reading',
          title: 'When does halt happen?',
          blocks: [
            { t: 'p', md: 'Three everyday situations put a halt through the tree:' },
            { t: 'list', items: [
              'A parent **rewinds**: a plain `Sequence` whose later child FAILS resets all of its children — any one that was RUNNING gets halted as the plan rewinds to child 1.',
              'A control/decorator node decides this branch must not continue — the classic case is a `ReactiveSequence` whose cheap guard condition goes false while the RUNNING branch is mid-motion.',
              'External reset — `tree.haltTree()`, e.g. from WPILib `end(true)` when the auto is cancelled. It walks the whole tree and halts every still-RUNNING node.',
            ] },
            { t: 'p', md: 'Halting propagates DOWNWARD: a halted control/decorator node halts its children recursively, until leaf RUNNING nodes reach `onHalted()`. After a halt every node is IDLE — ready for a clean retry.' },
            { t: 'tip', md: 'Think of `onHalted` as the emergency brake of your custom node: anything you started that touches hardware needs a defined stop path. (And `CommandActionNode` gets one automatically — its `onHalted` cancels the command.)' },
            { t: 'p', md: 'Below, watch the REACTIVE pattern in the simulator: a `ReactiveSequence` re-asks a cheap `Safe` sensor every tick. When it loses the go-ahead, the RUNNING mechanism behind it is **halted mid-motion**.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Aborting a mechanism the reactive way',
          workspace: {
            brief: 'The launcher must spin only while the shooter is aligned. Run the tree: the flag `go` is set to 0 mid-run (simulating poor sensor data), and `SpinFlywheel` must be politely halted. **Watch the ticks** — this is exact Robot behavior, step by step.',
            tasks: [
              'Run the default tree, use Step if you want detail; note exactly which tick SpinFlywheel halts on',
              'Check the blackboard after — `speed` must be stuck mid-motion (50 rpm), not 100+',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Reactive">
  <BehaviorTree ID="Reactive">
    <ReactiveSequence>
      <Safe/>
      <SpinFlywheel/>
    </ReactiveSequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Reactive">
  <BehaviorTree ID="Reactive">
    <ReactiveSequence>
      <Safe/>
      <SpinFlywheel/>
    </ReactiveSequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              Safe: { type: 'condition', tick: (ctx) => (ctx.blackboard.get('go','int') > 0 ? 'SUCCESS' : 'FAILURE') },
              SpinFlywheel: {
                type: 'stateful',
                onStart: (ctx) => { ctx.blackboard.set('speed', 0); return 'RUNNING'; },
                onRunning: (ctx) => { const s = ctx.blackboard.get('speed','double'); ctx.blackboard.set('speed', s + 25); return 'RUNNING'; },
                onHalted: (ctx) => { ctx.blackboard.set('halted', 1); ctx.log('[SpinFlywheel] onHalted → stop'); },
              },
            },
            beforeTick: (() => {
              let last = null;
              return (runner) => {
                if (runner !== last) { last = runner; runner.blackboard.set('go', 1); }
                if (last !== null && runner.tickIndex >= 4 && runner.blackboard.get('go','double') !== 0) runner.blackboard.set('go', 0);
              };
            })(),
              validators: [
              { label: 'SpinFlywheel was halted', check: (api) => api.get('halted') === 1 || 'the mechanism never received onHalted' },
              { label: 'halt happened mid-motion (speed 25..75, not 100+)', check: (api) => (api.get('speed') >= 25 && api.get('speed') <= 75) || `speed ${api.get('speed')} — the launcher should NOT keep spinning while the guard says no` },
              { label: 'the safe sensor was re-asked', check: (api) => api.ticksOf('Safe') >= 4 || 'ReactiveSequence must re-tick Safe on later ticks' },
            ],
            hints: [
              'ReactiveSequence: on FAILURE of an earlier (cheap) child, the branch stops and RUNNING children are halted.',
              'beforeTick in the sim flips `go` to 0 on tick 4 — exactly the annoying middle of an auto run.',
              'The halt SPEED check is the point: onHalted stopped the ramp mid-motion, instantaneously.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What happens to the top-level BehaviorTreeCommand if a leaf keeps returning RUNNING forever?',
              options: [
                'The autonomous period times it out at 15 s and moves on',
                'The command keeps ticking until cancelled — isFinished() only returns true on SUCCESS/FAILURE',
                'WPILib ends auto commands after 30 seconds automatically',
              ],
              correct: 1,
              explain: 'isFinished() is wired to the root status, so a never-finishing tree ticks forever on your robot. The autonomous 15-second period is enforced by the FIELD, not your command — but for a branch that hangs, put a `Timeout` around it (unit 6).',
              hint: 'Who decides "finished" for your command — and who enforces the field clock?',
            },
          ],
        },
      ],
    },
    {
      id: 'restart-memory',
      title: 'Restart, react, remember',
      items: [
        {
          kind: 'reading',
          title: 'Three Sequences, three kinds of patience',
          blocks: [
            { t: 'table', cols: ['Node', 'On child FAILURE', 'On child RUNNING', 'Use when'], rows: [
              ['`Sequence`', 'reset all children; the next attempt starts from child 1', 'resume next tick (that child owns the tick)', 'plain ordered plans'],
              ['`ReactiveSequence`', 'reset all children; restart from child 1', 'earlier children are RE-TICKED every tick (guards checked continuously)', 'ordered plans with cheap, re-checked guards'],
              ['`SequenceWithMemory` (alias `SequenceStar`)', 'resume AT the failed child — earlier completed steps do not repeat', 'resume at the running child', 'plans where repeating an expensive completed step would be wasteful or unsafe'],
              ['`AsyncSequence`', 'reset all children (like Sequence)', 'returns RUNNING immediately after a child completes, then advances on the next tick', 'spreading one-tick children across ticks instead of finishing several in one pass'],
            ] },
            { t: 'p', md: 'The one to internalize: **plain Sequence restarts from child 1 after a FAILURE.** If `[A, B, C]` keeps failing at C, plain Sequence re-runs A and B on every attempt — fine when they are cheap, expensive or unsafe when not. That is exactly what `SequenceWithMemory` trades: keep the cursor at the failing child and do not repeat the completed steps.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'memory.xml', code: '<SequenceWithMemory>\n  <Arm ms="100"/>      <!-- runs exactly once, even if Collect fails repeatedly -->\n  <Collect ms="200"/>\n</SequenceWithMemory>' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Count the restarts',
          workspace: {
            brief: 'A `Collect` leaf fails twice (a jam), then succeeds. That would normally abort the auto — so both attempts below are wrapped in a `Retry` (unit 6 previews it: it re-ticks its child after each failure). Run the **memory variant** below: inside `Retry`, a plain `Sequence` would re-run the `Arm` three times, while `SequenceWithMemory` re-ticks only the failed child. Run & check, then try swapping `SequenceWithMemory name="SeqMem"` for `Sequence name="SeqPlain"` and see the *Arm* count triple.',
            tasks: [
              'Keep the Retry envelope, with Arm then Collect inside',
              'Use <SequenceWithMemory name="SeqMem"> for the checks below',
              'Compare with <Sequence name="SeqPlain"> to watch Arm restart (then switch back)',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Plan">
  <BehaviorTree ID="Plan">
    <Retry num_attempts="5">
      <SequenceWithMemory name="SeqMem">
        <Arm name="Minion"/>
        <Collect name="CollectCounting"/>
      </SequenceWithMemory>
    </Retry>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Plan">
  <BehaviorTree ID="Plan">
    <Retry num_attempts="5">
      <SequenceWithMemory name="SeqMem">
        <Arm name="Minion"/>
        <Collect name="CollectCounting"/>
      </SequenceWithMemory>
    </Retry>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              Arm: { type: 'stateful', onStart: () => 'SUCCESS' },
              Collect: {
                type: 'stateful',
                onStart: (ctx) => {
                  const prev = ctx.blackboard.tryGet('collectCalls');
                  const n = (prev.present ? prev.value : 0) + 1;
                  ctx.blackboard.set('collectCalls', n);
                  return n <= 2 ? 'FAILURE' : 'SUCCESS';
                },
              },
            },
            validators: [
              { label: 'Collect was attempted 3 times (2 fails + 1 pass)', check: (api) => api.get('collectCalls') === 3 || `collect calls = ${api.get('collectCalls')}` },
              { label: 'Arm ticked exactly once — memory kept the arm still', check: (api) => api.ticksOf('Minion') === 1 || `Arm ticked ${api.ticksOf('Minion')} times — that is the plain-Sequence restart behavior` },
              { label: 'tree finished SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'Retry(n) gives the sequence "n attempts" — each failed attempt re-ticks the sequence.',
              'SequenceWithMemory resumes AT the failed child; plain Sequence re-runs from the start.',
              'Count only onStart ticks: a failed start then success after 2 restarts = 3.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Which Sequence restarts ALL completed children when a later child fails?',
              options: ['SequenceWithMemory', 'Both Sequence and ReactiveSequence', 'AsyncSequence only'],
              correct: 1,
              explain: 'Plain Sequence resets all children on a child FAILURE; ReactiveSequence re-ticks its earlier children every pass anyway. Only SequenceWithMemory keeps its cursor across failures (deliberately: does not reset currentChildIdx on a FAILURE).',
              hint: 'Which two reset the current index on FAILURE?',
            },
            {
              q: 'A cheap sensor is re-queried effectively each tick only if…',
              options: [
                'it is placed inside a plain Sequence before the RUNNING child',
                'it sits before a RUNNING child in a ReactiveSequence',
                'conditions re-run every tick in any container',
              ],
              correct: 1,
              explain: 'Re-asking depends on the PARENT: ReactiveSequence (and ReactiveFallback) deliberately tick earlier children again instead of storing a cursor like plain Sequence.',
              hint: 'Reactiveness is a feature of the parent, not the leaf.',
            },
          ],
        },
      ],
    },
  ],
};
