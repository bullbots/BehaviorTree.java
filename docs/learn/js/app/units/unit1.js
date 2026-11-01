// UNIT 1 — First Tick. What behavior trees are, why FRC robots love them, NodeStatus anatomy,
// and the first <Sequence> running visibly in the simulator.

/* Simulated WPILib CommandScheduler: every `type:'command'` mock registers itself here when the
 * tree starts it; beforeTick advances all of them once per tick (exactly like robotPeriodic()
 * flows through CommandScheduler.run() before each tree tick). The list resets whenever the
 * workspace builds a fresh Runner (Run & check always does). */
const sched = (() => {
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

/** Read an int input port with a fallback default (tryGetInput returns {present,value}). */
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };
/** A mock WPILib Command that finishes after `ms` simulated milliseconds. */
const timedCmd = (defMs, name = 'ms') => (ctx) => {
  const c = { _scheduled: true, left: Math.ceil(msOf(ctx, name, defMs) / 50) };
  c.update = () => { c.left -= 1; if (c.left <= 0) c._scheduled = false; };
  sched.add(c); return c;
};

export default {
  id: 1,
  color: '#34b3a0',
  title: 'First Tick',
  tagline: 'What a behavior tree is and why FRC robots love them.',
  lessons: [
    {
      id: 'bt-what',
      title: 'What is a behavior tree?',
      items: [
        {
          kind: 'reading',
          title: 'Meet the tree',
          blocks: [
            { t: 'p', md: 'FRC robot code has traditionally been written as **subsystems + commands** — a state machine the scheduler walks every 20 ms. That works beautifully for driver-controlled teleop. But an **autonomous routine** is a plan: *do A, if it fails do B, keep trying C until timeout…*. Describing that as a heap of `ScheduledPriority`-isms gets tangled fast.' },
            { t: 'p', md: 'A **behavior tree** describes that plan as a tree. Leaves do things (actions, run commands, check conditions); interior nodes make decisions (sequence, pick-an-alternative, run-in-parallel). The tree is **data**: it lives in an XML file, can be edited without recompiling, and the same engine walks any tree you give it.' },
            { t: 'h', text: 'Three kinds of nodes', level: 2 },
            { t: 'list', items: [
              '**Leaf action nodes** — `Intake`, `Shoot`, `DriveTo`. They "do" and finish with a result.',
              '**Leaf condition nodes** — `BallIsLoaded`. They *ask* and promise to never run across ticks.',
              '**Interior flow-control nodes** — `Sequence`, `Fallback`, `Parallel`, plus one-child **decorators** like `Timeout` and `Retry`.',
            ] },
            { t: 'p', md: 'Here is what a real FRC autonomous tree looks like — this one ships in the <b>BehaviorTree.java</b> example robot:' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'autonomous.xml', code: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <Intake/>
      <Timeout msec="4000">
        <Shoot/>
      </Timeout>
    </Sequence>
  </BehaviorTree>
</root>` },
            { t: 'tip', md: 'BehaviorTree.java is a faithful Java port of BehaviorTree.CPP v4 for WPILib. Everything you learn here — XML format, ports, the scripting language — transfers directly to the robot.' },
          ],
        },
        {
          kind: 'reading',
          title: 'NodeStatus — the only four outcomes that matter',
          blocks: [
            { t: 'p', md: 'Every node, on every tick, reports one of the same five statuses — `Enum` `NodeStatus`:' },
            { t: 'table', cols: ['Status', 'Meaning', 'Tick again before that?'], rows: [
              ['**SUCCESS**', 'the work is done', 'no — this pass is over'],
              ['**FAILURE**', 'the work did not happen', 'no — but a parent may react (retry, pick another child)'],
              ['**RUNNING**', 'not done yet — call me next tick', 'yes — the SAME node is re-ticked'],
              ['**SKIPPED**', 'as if this node was not in the tree', 'no — the parent moves on'],
              ['**IDLE**', 'internal: never ticked yet', 'n/a — you never see a well-behaved node return this'],
            ] },
            { t: 'p', md: 'That is the whole contract. **RUNNING is the only status that carries work across ticks.** A `Sequence` ticks child 1; if it is RUNNING, the whole sequence is RUNNING and child 2 has not even been looked at. Next tick the sequence resumes exactly where it was.' },
            { t: 'note', md: 'Why not just `boolean done()`? Because "the intake is spinnning, 2/3 done" IS a step of a plan, not an instant event. RUNNING turns plans into step-by-step progress.' },
            { t: 'p', md: 'Conditions are different: a `ConditionNode` **must not return RUNNING**. It is an instant question — `SUCCESS` (condition holds now) or `FAILURE` (it does not). This is enforced by the Java base class design and you will rely on it constantly in `ReactiveSequence`.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'A `Sequence` node with children `[A, B, C]` ticks and A returns RUNNING. What does the sequence return this tick, and what happens next tick?',
              options: [
                'FAILURE — the tree gives up and restarts from A',
                'RUNNING — next tick resumes at A again, B untouched',
                'RUNNING — but next tick it starts at B',
                'SUCCESS with a note that B and C are pending',
              ],
              correct: 1,
              explain: 'RUNNING propagates upward as "this branch owns the tick". The sequence remembers its current child index and re-ticks from there — nothing after A runs while A is not finished.',
              hint: 'RUNNING means "same node, next tick, and nothing after it".',
            },
            {
              q: 'Can a ConditionNode return RUNNING?',
              options: [
                'Yes, while it waits for sensors to agree',
                'No — conditions answer an instant question: SUCCESS or FAILURE',
                'Only inside a ReactiveSequence',
              ],
              correct: 1,
              explain: 'A condition must be instant so control nodes can re-evaluate it cheaply on every tick. Anything that takes time should be an action (which may return RUNNING).',
              hint: 'Think of conditions as pure sensor questions — questions never take time.',
            },
            {
              q: 'Why does behavior-tree XML live in a file instead of Java code?',
              options: [
                'It is faster to load from a file',
                'Trees are data: deploy a new autonomous routine without touching robot code',
                'WPILib requires the .xml extension',
              ],
              correct: 1,
              explain: 'The factory walks ANY tree from text. Team programmers keep their node library in Java, while drivers/analysts can tune the routine XML-to-deploy between matches.',
              hint: 'Think about how gameplay teams adjust an auto right before a match.',
            },
          ],
        },
      ],
    },
    {
      id: 'the-tick',
      title: 'The tick, step by step',
      items: [
        {
          kind: 'reading',
          title: 'One tick = the tree visits nodes top-down',
          blocks: [
            { t: 'p', md: 'The engine entry point is `tree.tickOnce()`. That single call walks the tree: the root node ticks, and interior nodes tick their children **as needed**, resuming where a previous tick left off. In the WPILib integration, `BehaviorTreeCommand.execute()` calls exactly one `tickOnce()` per scheduler run — mirroring how the tree is ticked from an externally driven periodic loop.' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'Tree.java', code: `public final class Tree
{
  public TreeNode rootNode;
  public Blackboard rootBlackboard;

  public NodeStatus tickOnce()
  {
    ...
    return rootNode.executeTick();
  }

  public NodeStatus tickWhileRunning(long sleepMillis) { ... }
  public void haltTree() { ... }
}` },
            { t: 'p', md: 'Each node visit runs through `executeTick()`, which — **always the same three steps**:' },
            { t: 'list', items: [
              'evaluate the node\'s **pre-condition scripts** (`_skipIf`, `_successIf`, `_while` — unit 8), which can shortcut the whole tick assignment',
              'call the node\'s own `tick()`',
              'evaluate **post-condition scripts** (`_onSuccess`, `_onFailure`, `_post`) and set the node\'s status',
            ] },
            { t: 'note', md: 'One important subsystem behavior: when a node returns SKIPPED, its internal status stays IDLE — it is "as if it were not in the tree". Only visited real ticks come afterwards the caller.' },
            { t: 'p', md: 'In the simulator below, one **tick = 50 simulated ms**. Press **Step 1 tick** a few times and watch the running node light up; then press **Run** and let it finish. The tree here is: `Sequence` → (`Punch`, `Retract`). Punch finishes instantly (SUCCESS), then Retract takes 3 ticks (RUNNING, RUNNING, SUCCESS), and only then does the whole Series report SUCCESS.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Watch a Sequence run',
          workspace: {
            brief: 'This is a **simulated mechanism** with two stateful actions. **Step** through the first ~6 ticks and watch each node\'s status pill update as it runs; then press **Run** and let the plan complete. The grader reruns everything itself — the buttons are for observation.',
            tasks: [
              'Press Step until Retract is RUNNING (watch the tab info colors)',
              'Press Run — the tree finishes to SUCCESS',
              'Run & check to confirm you saw the whole plan',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Demo">
  <BehaviorTree ID="Demo">
    <Sequence>
      <Punch/>
      <Retract ms="100"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Demo">
  <BehaviorTree ID="Demo">
    <Sequence>
      <Punch/>
      <Retract ms="100"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              Punch: { type: 'stateful', onStart: (ctx) => { ctx.log('[Punch] extend the hood on one tick'); return 'SUCCESS'; } },
              Retract: {
                type: 'stateful',
                ports: [{ dir: 'input', name: 'ms', type: 'int' }],
                onStart: (ctx) => { const r = ctx.tryGetInput('ms','int'); ctx.blackboard.set('retractLeft', Math.ceil((r.present ? r.value : 100) / 50)); ctx.log('[Retract] begin the motion'); return 'RUNNING'; },
                onRunning: (ctx) => { const left = ctx.blackboard.get('retractLeft','int'); ctx.blackboard.set('retractLeft', left - 1); return left - 1 > 0 ? 'RUNNING' : 'SUCCESS'; },
                onHalted: (ctx) => ctx.log('[Retract] halted mid-motion!'),
              },
            },
            validators: [
              { label: 'Punch ran exactly once', check: (api) => api.ticksOf('Punch') === 1 || `Punch ticked ${api.ticksOf('Punch')} time(s) — expected 1.` },
              { label: 'Retract reported RUNNING before finishing', check: (api) => api.ticksOf('Retract') >= 3 || 'Retract should take at least 3 ticks' },
              { label: 'Tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || 'tree ended with ' + api.status },
            ],
            hints: [
              'Step and Run only *watch* the tree — the grader starts a fresh run itself.',
              'The visualizer colors RUNNING nodes blue and finished ones teal/red.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Your tree has one tick available per periodic cycle. If `Retract` returns RUNNING 3 times, how many scheduler cuts have elapsed before the tree completes?',
              options: ['1', '3', '4', 'depends on the blackboard'],
              correct: 2,
              explain: 'Retract runs over 3 ticks ON TOP of the tick where Punch finished (and Retract first returns RUNNING). Autonomous time budget ≠ ticks of state, plan accordingly.',
              hint: 'Count every tick, including the one where anything else succeeded before.',
            },
          ],
        },
      ],
    },
    {
      id: 'first-tree',
      title: 'Write your first tree',
      items: [
        {
          kind: 'exercise',
          title: 'Build: intake, then shoot',
          workspace: {
            brief: 'The robot knows two commands that take real simulated time: `Intake` and `Shoot`. Build the classic two-step autonomous — **intake a game piece, then shoot** — as a `Sequence`. Time each command from its `ms` port (leave the defaults).',
            tasks: [
              'Wrap `Intake` then `Shoot` in a `<Sequence>` inside `<BehaviorTree ID="Auto">`',
              'Keep `main_tree_to_execute="Auto"`',
              'Intake must finish before Shoot even starts',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">

    <!-- build the tree here: Intake, then Shoot -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <Intake ms="400"/>
      <Shoot ms="300"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 120,
            nodes: {
              Intake: {
                type: 'command',
                ports: [{ dir: 'input', name: 'ms', type: 'int', default: '400' }],
                supplier: timedCmd(400),
              },
              Shoot: {
                type: 'command',
                ports: [{ dir: 'input', name: 'ms', type: 'int', default: '300' }],
                supplier: timedCmd(300),
              },
            },
            beforeTick: (runner) => sched.step(runner),
            validators: [
              { label: 'Tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended with ${api.status ?? 'nothing'}` },
              { label: 'Both leaves returned SUCCESS', check: (api) => (api.lastReturnOf('Intake') === 'SUCCESS' && api.lastReturnOf('Shoot') === 'SUCCESS') || 'both Intake and Shoot must end SUCCESS' },
              { label: 'Commands take real time (Intake ≥ 8 ticks)', check: (api) => api.ticksOf('Intake') >= 8 || `Intake only ticked ${api.ticksOf('Intake')} times — keep ms="400"` },
            ],
            hints: [
              'A <Sequence> contains its children in order: <Sequence><Intake/><Shoot/></Sequence>.',
              'XML elements self-close: <Intake/>. Input ports are attributes: <Intake ms="400"/>.',
              'The grader rebuilds and reruns everything itself — the buttons are just for watching.',
            ],
          },
        },
        {
          kind: 'java',
          title: 'Study real Java: the factory + one tick per periodic',
          blocks: [
            { t: 'p', md: 'Here is the real wiring from the example robot. `RobotContainer` registers leaf nodes, loads the tree from deploy files, and hands out a command the scheduler can run:' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'RobotContainer.java', code: `public class RobotContainer
{
  private final BehaviorTreeFactory factory = new BehaviorTreeFactory();
  private final Tree autonomousTree;

  public RobotContainer()
  {
    // Any node ID used in autonomous.xml must be registered here first.
    WpilibNodes.registerCommandAction(factory, "Intake",
                                      () -> new IntakeCommand(intakeSubsystem));
    WpilibNodes.registerCommandAction(factory, "Shoot",
                                      () -> new ShootCommand(shooterSubsystem));

    autonomousTree = factory.createTreeFromFile(
        Path.of(Filesystem.getDeployDirectory().toString(), "autonomous.xml"));

    // Optional: watch the tree run live on Shuffleboard/Elastic/AdvantageScope
    new NTBehaviorTreeLogger(autonomousTree,
        NetworkTableInstance.getDefault().getTable("BehaviorTree"));
  }

  public Command getAutonomousCommand()
  {
    return new BehaviorTreeCommand(autonomousTree, intakeSubsystem, shooterSubsystem);
  }
}` },
            { t: 'p', md: '`registerCommandAction` makes the ID names in XML (`<Intake/>`) resolve to **WPILib commands**. `BehaviorTreeCommand` (unit 9) runs `tree.tickOnce()` exactly once per `execute()` — so one scheduler cut = one tick of the tree.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Checkpoint',
          questions: [
            {
              q: 'A node ID appears in `autonomous.xml` but was never registered on the factory. What happens when the tree is built?',
              options: [
                'The node silently does nothing',
                'A LogicError is thrown: the XML references an unknown node ID',
                'The whole tree skips that node at tick time',
              ],
              correct: 1,
              explain: 'Building fails fast — BehaviorTreeFactory cannot build a tree whose node IDs it does not know. Register every leaf before createTreeFromFile().',
              hint: 'Trees are built once at startup; the factory needs every ID defined.',
            },
          ],
        },
      ],
    },
  ],
};
