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
  private double startRpm;

  public SpinFlywheelNode(String name, NodeConfig config) { super(name, config); }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Double.class, "rpm", 3000.0, "target flywheel speed"));
  }

  @Override
  protected NodeStatus onStart()
  {
    startRpm = 0.0;                                   // fresh state every start
    shooterSubsystem.spinTo(getInput("rpm", Double.class));
    return NodeStatus.RUNNING;                        // "this will take a few ticks"
  }

  @Override
  protected NodeStatus onRunning()
  {
    double now = shooterSubsystem.rpm();
    if (now < 0.95 * getInput("rpm", Double.class)) return NodeStatus.RUNNING;
    return NodeStatus.SUCCESS;
  }

  @Override
  protected void onHalted()
  {
    shooterSubsystem.stop();                          // crash-safe: always defined
  }
}` },
            { t: 'p', md: 'The stateful contract, straight from the Java base class:' },
            { t: 'list', items: [
              'First tick (status IDLE) → `onStart()`. May return RUNNING, SUCCESS (instant), or FAILURE — **never IDLE**.',
              'Subsequent ticks while RUNNING → `onRunning()`. Return RUNNING to keep the tick, or a finished status to end.',
              '`haltNode()` → `halt()` → if the node was RUNNING, `onHalted()` runs. Its job: make the robot SAFE. No return value — the node ends what\'s "supposed" to be SKIPPED/IDLE by the wrapper.',
            ] },
            { t: 'warn', md: 'Do all state reset in `onStart`, not the constructor — a tree can restart many times between robot brown-outs (tree ids never re-created in one `autonomous.xml`). The same Node object is re-ticked across restarts of the tree: one port manifest + three callbacks per instance.' },
            { t: 'note', md: 'You saw this under real Java integration in the WPILib layer: `CommandActionNode` (unit 9) is a StatefulActionNode whose "state" is the live Command handle.' },
          ],
        },
        {
          kind: 'exercise',
          title: "Step through onStart → onRunning → SUCCESS",
          workspace: {
            brief: 'The sim carries `SpinFlywheel` exactly as the Java class above. Step the first ~8 ticks and use the tree view to catch the status transitions. Then let the grader verify the sequence of states.',
            tasks: [
              'Run the default tree — it is already correct',
              'Note how `spin ticks` and the blackboard speed climb in tandem',
              'Run & check',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Spinup">
  <BehaviorTree ID="Spinup">
    <SpinFlywheel rpm="120"/>
    <!-- rpm="120" → 120 rpm moves in steps of 25 per tick -->
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
              { label: 'onStart ran exactly once', check: (api) => api.ticksOf('SpinFlywheel') >= 5 || 'SpinFlywheel should run several ticks' },
              { label: 'final speed 125 rpm', check: (api) => api.get('speed') >= 125 || `speed = ${api.get('speed')}` },
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
      title: 'Halting: stopping a plan mid-pride',
      items: [
        {
          kind: 'reading',
          title: 'When does halt happen?',
          blocks: [
            { t: 'p', md: 'Three everyday situations put a halt through the tree:' },
            { t: 'list', items: [
              'The **root completes** while an older branch is still RUNNING-looking (Sequence restarts and schedules fresh plans), e.g. sequence FAILURE from a later step is passed through children restart.',
              'A control- or decorator-node decides this branch should not continue — e.g. `ReactiveSequence` containing a flag condition that goes false while the RUNNING branch is mid-motion.',
              'External reset — `tree.haltTree()` via Wpilib `end(true)` or mine Cleanup scripts. A tick\'s `haltTree()` scans every node, halting any that are RUNNING.',
            ] },
            { t: 'p', md: 'Halting propagates DOWNWARD: a halted control/decorator halts its children recursively until leaf RUNNING nodes reach `onHalted()`. After the halt, every node sports IDLE — ready to be retried cleanly.' },
            { t: 'tip', md: 'Think of `onHalted` as the emergency launch brake of your custom node. Anything you start that keeps a motor swapping with the hardware needs a defined cancel path (and `CommandActionNode` gets it automatically — its onHalted cancels the command).' },
            { t: 'p', md: 'Below, watch the REACTIVE pattern in the simulator: a `ReactiveSequence` re-asks a cheap `Safe` sensor every tick. When it loses the go-ahead, the RUNNING mechanism behind it is **halted mid-motion**.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Aborting a mechanism the reactive way',
          workspace: {
            brief: 'The launcher must spin only while the shooter is aligned. Run the tree: the flag `go` is set to 0 mid-run (simulating poor sensor data), and `SpinFlywheel` must be politely halted. **Watch the ticks** — this is exact Robot behavior, step by step.',
            tasks: [
              'Run the default tree, use Step if you want detail; note when SpinFlywheel halts',
              'Check the blackboard after — `speed` must be capped near 90 rpm',
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
              { label: 'halt happened mid-motion (speed 25..75 at halt, not 100+)', check: (api) => (api.get('speed') >= 25 && api.get('speed') <= 75) || `speed ${api.get('speed')} — the robot should NOT keep spinning while the sensor has stopped agreeing` },
              { label: 'the safe sensor was re-asked', check: (api) => api.ticksOf('Safe') >= 4 || 'ReactiveSequence must re-tick Safe on later ticks' },
            ],
            hints: [
              'ReactiveSequence: on FAILURE of an earlier (cheap) child, the traffic stops and RUNNING children are halted.',
              'beforeTick in the sim sets go := 0 on tick 4 — exactly the surprising middle of an auto run.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What happens to the TOP-level BehaviorTreeCommand if your RUNNING node keeps status RUNNING but refuses to ever finish?',
              options: [
                'Auto mode times out at 15 s regardless',
                'The command runs forever until cancelled — isFinished() is only SUCCESS/FAILURE',
                'WPILib resets subsystems automatically after 30 robber periods',
              ],
              correct: 1,
              explain: 'A tree that never sets its root failure produces an auto that drives nowhere exactly. For a "too slow" branch: Timeout (unit 6) or a keep-alive FAILURE in your recovery conditions. Autonomous periods also come from field control, naturally.',
              hint: 'Who implements your tree\'s clock? Also note: a FRC auto period is host-controlled; your tree is not.',
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
              ['`Sequence`', 'restart from child 1 next tick', 'resume next tick (A owns the tick)', 'plain ordered plans'],
              ['`ReactiveSequence`', 'resets, same restart path', 'earlier children are RE-TICKED every tick', 'ordered plans with cheap, re-checked guards'],
              ['`SequenceWithMemory` (alias `SequenceStar`)', 'resumes at the failed child', 'resume at the running child', 'plans where earlier steps must not repeat'],
              ['`AsyncSequence`', 'restart (like Sequence)', 'returns RUNNING right after a child completed, before advancing', 'letting one-tick children call through without merging multiple steps per tick'],
            ] },
            { t: 'p', md: 'There is a subtle behavior worth seeing once in the visualizer: **plain Sequence RESTARTS the whole brain after a FAILURE.** If `C` fails as the third tick D 5 ticks each, everything starts again. For a battery that functioned as intended: place a WAIT some place at the start, or use SequenceWithMemory to reduce restart costs for the earlier steps.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'memory.xml', code: `<SequenceWithMemory>
  <Arm ms="100"/>      <!-- runs a total of 1 time, even if Collect fails 5 times -->
  <Collect ms="200"/>
</SequenceWithMemory>` },
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
              explain: 'Plain Sequence resets all children on child-failure; ReactiveSequence quizzes/ticks its previous children every pass anyway. Only SequenceWithMemory preserves its cursor across failures (deliberately not resetting currentChildIdx on halt).',
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
