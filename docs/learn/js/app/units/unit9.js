// UNIT 9 — On the Robot (WPILib) plus the capstone. CommandActionNode + registerCommandAction,
// BehaviorTreeCommand semantics, NTBehaviorTreeLogger + dashboards, and the full simulated
// autonomous capstone (path → intake → aim → 2× shoot with timeout, reactive abort).
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
/** A mock WPILib Command modeled directly on CommandActionNode's lifecycle. */
const command = (defMs, name = 'ms') => (ctx) => {
  const r = ctx.tryGetInput(name, 'int');
  const c = { _scheduled: true, left: Math.ceil((r.present ? r.value : defMs) / 50) };
  c.update = () => { c.left -= 1; if (c.left <= 0) c._scheduled = false; };
  c.cancel = () => { c._scheduled = false; c._cancelled = true; };
  scheduler.add(c); return c;
};
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };

export default {
  id: 9,
  color: '#2c5c8a',
  title: 'On the Robot (WPILib)',
  tagline: 'Wire trees into the FRC scheduler and ship a full autonomous. Capstone inside.',
  lessons: [
    {
      id: 'commands',
      title: 'Commands as tree leaves',
      items: [
        {
          kind: 'java',
          title: 'Code study: CommandActionNode',
          blocks: [
            { t: 'p', md: '`java/behaviortree-wpilib` wraps your existing WPILib commands as tree leaves. The class is a StatefulActionNode whose "state" is a live Command handle:' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'CommandActionNode.java', code: `public class CommandActionNode extends StatefulActionNode
{
  private final Supplier<Command> commandSupplier;
  private Command command;

  @Override
  public NodeStatus onStart()
  {
    command = commandSupplier.get();                  // FRESH command every start
    CommandScheduler.getInstance().schedule(command); // normal requirement rules apply
    return NodeStatus.RUNNING;
  }

  @Override
  public NodeStatus onRunning()
  {
    return CommandScheduler.getInstance().isScheduled(command)
        ? NodeStatus.RUNNING                          // still executing
        : NodeStatus.SUCCESS;                          // finished OR interrupted
  }

  @Override
  public void onHalted()
  {
    if (command != null) CommandScheduler.getInstance().cancel(command);
  }
}` },
            { t: 'p', md: 'Why a **fresh instance on every IDLE transition**? A WPILib Command is not meant to be re-scheduled after it ended; the tree may start `Intake` twice per auto, so we demand a new one each time from the supplier. And because scheduling happens through the **CommandScheduler**, stalled subsystem requirements and cancel() interplay keep working exactly like you are used to.' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'WpilibNodes.java', code: `WpilibNodes.registerCommandAction(factory, "Intake",
                                  () -> new IntakeCommand(intakeSubsystem));
// shorthand for:
//   factory.registerNodeType("Intake", new PortsList(), NodeType.ACTION,
//       (name, config) -> new CommandActionNode(name, config,
//                                               () -> new IntakeCommand(intakeSubsystem)));` },
            { t: 'note', md: 'Port-carrying leaves are natural here: `registerCommandAction(factory, id, ports, supplier)` accepts a PortsList so `<Intake ms="400"/>` can configure the command (make sure your Command reads its constructor params).' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'A conflicting requirement cancels the IntakeCommand late in auto. What does the CommandActionNode report?',
              options: [
                'FAILURE — the command was interrupted',
                'SUCCESS — onRunning only asks isScheduled; the node cannot tell finished from interrupted',
                'It throws',
              ],
              correct: 1,
              explain: 'That is upstream-faithful behavior (and documented in the Java source): once the command is no longer scheduled, the node is DONE either way. If interruption matters, add a condition node that observes the relevant sensor state.',
              hint: 'Re-read onRunning() — everything looks like SUCCESS.',
            },
            {
              q: 'Why does onStart() schedule a fresh command instead of reusing the field?',
              options: [
                'WPILib Commands should not be re-scheduled after ending',
                'To keep telemetry stack traces fresh',
                'Commands are too big to reuse',
              ],
              correct: 0,
              explain: 'Commands carry end-state; their isFinished() is latched. Every IDLE→start transition in the tree asks the Supplier for a brand-new Command — mirrors exactly how the scheduler treats them normally.',
              hint: 'What happens the second time you schedule a finished Command?',
            },
          ],
        },
      ],
    },
    {
      id: 'btcommand',
      title: 'BehaviorTreeCommand: the auto-period boundary',
      items: [
        {
          kind: 'java',
          title: 'Code study: the whole class (it is this small)',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'BehaviorTreeCommand.java', code: `public class BehaviorTreeCommand extends Command
{
  private static final String FPGA_TIMESTAMP_KEY = "_fpgaTimestamp";
  private final Tree tree;

  public BehaviorTreeCommand(Tree tree, Subsystem... requirements)
  {
    this.tree = tree;
    addRequirements(requirements);          // declare ownership up front
  }

  @Override
  public void initialize()
  {
    tree.rootBlackboard.set(FPGA_TIMESTAMP_KEY, Timer.getFPGATimestamp());
    tree.rootNode.resetStatus();            // tree back to IDLE
  }

  @Override
  public void execute()
  {
    tree.rootBlackboard.set(FPGA_TIMESTAMP_KEY, Timer.getFPGATimestamp());
    tree.tickOnce();                        // EXACTLY one tree tick per scheduler run
  }

  @Override
  public boolean isFinished()
  {
    NodeStatus status = tree.rootNode.status();
    return status == NodeStatus.SUCCESS || status == NodeStatus.FAILURE;
  }

  @Override
  public void end(boolean interrupted)
  {
    tree.haltTree();                        // safety: stop every RUNNING node
  }
}` },
            { t: 'list', items: [
              '\Micro-batching: `execute()` performs ONE `tickOnce()`. The WPILib scheduler cadence (each `robotPeriodic`) is your tick loop — no thread, no sleep.',
              '`_fpgaTimestamp` is a PRIVATE key written every tick: scripts and custom nodes can measure elapsed time (`time := _fpgaTimestamp`) without dragging WPILib into your node code.',
              '`isFinished()` matches the ROOT status only — SUCCESS *or* FAILURE both end the command; the tree\'s plan decides how an auto ends.',
              '`end(interrupted)` → `tree.haltTree()`: every RUNNING leaf (all of them: stateful actions, Command leaves) gets its halt — the crash-safe exit.',
            ] },
            { t: 'note', md: 'The simulator\'s Runner implements this exact contract: fresh tree per run, `beforeTick` before each tick (like CommandScheduler.run() before your execute), halt semantics on reset.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Auto is cancelled 4 seconds in while DrivePath is RUNNING. In order, what runs?',
              options: [
                'execute() → isFinished() → end(false)',
                'interrupted=true: end(true) → haltTree() → DrivePath cancel + onHalted',
                'Nothing — auto state persists to teleop',
              ],
              correct: 1,
              explain: 'The CommandScheduler marks the command interrupted and calls end(true). haltTree() is your safety layer: leaves receive halts, CommandActionNode.onHalted cancels the live command, motors stop.',
              hint: 'haltTree() is the only thing that can reach a RUNNING branch from outside the tick.',
            },
            {
              q: 'Your script notes elapsed time via `_fpgaTimestamp`. Who writes that key and when?',
              options: [
                'NTBehaviorTreeLogger at attach time',
                'BehaviorTreeCommand sets it on initialize() and every execute()',
                'You must write it yourself each tick',
              ],
              correct: 1,
              explain: 'It is a contract of BehaviorTreeCommand: the FPGA seconds-since-boot is refreshed every execute() into the root blackboard (private `_` namespace). Custom nodes read it freely.',
              hint: 'Only one place in the WPILib layer touches that key.',
            },
          ],
        },
      ],
    },
    {
      id: 'ntlogger',
      title: 'Watching the tree: NTBehaviorTreeLogger',
      items: [
        {
          kind: 'java',
          title: 'Code study + dashboard recipes',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'NTBehaviorTreeLogger.java', code: `public NTBehaviorTreeLogger(Tree tree, NetworkTable table)
{
  if (tree.rootNode != null) attach(tree.rootNode, table);
}

private void attach(TreeNode node, NetworkTable table)
{
  StringPublisher publisher = table.getStringTopic(node.fullPath()).publish();
  publisher.set(node.status().toString());
  subscriptions.add(node.subscribeToStatusChange(
      (time, n, prev, next) -> publisher.set(next.toString())));

  if (node instanceof ControlNode control)      for (TreeNode c : control.children())   attach(c, table);
  else if (node instanceof DecoratorNode d && d.child() != null) attach(d.child(), table);
}` },
            { t: 'p', md: 'Every node publishes its status **once per status change** to `StringTopic(node.fullPath())` under one table (e.g. `/BehaviorTree/Auto/Sequence/Intake` → `"RUNNING"`).' },
            { t: 'p', md: 'Upstream BT.CPP would use Groot2 + ZeroMQ for this; the Java port deliberately ships the NetworkTables equivalent (no exotic dependency on a robot = no vendordep pain). Point any of these at the table:' },
            { t: 'list', items: [
              '**AdvantageScope** — HUB layout: Trend + LiveHTML over `/BehaviorTree/*`; colorize the string per status.',
              '**Elastic / Shuffleboard** — a raw ListView widget shows which branch is live in real time.',
              '**A custom `StringSupplier` dashboard** — combo multiple fullPath() strings into one text box for driver feed.',
            ] },
            { t: 'note', md: 'Call `logger.close()` when done (e.g. teleop init) — it closes the status-change subscriptions and the NT publishers, freeing the topics.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What is the key of a node\'s status topic?',
              options: [
                'The node registration name only (`"Intake"`, useful when two nodes share it? — duplicate keys!)',
                'The node fullPath, like `/BehaviorTree/Auto/Sequence/Intake`',
                'A node uid hash',
              ],
              correct: 1,
              explain: 'fullPath() disambiguates repeated registration names inside one document — two `<Intake/>` leaves become /Auto/SequenceA/Intake and /Auto/SequenceB/Intake.',
              hint: 'Where do two same-named leaves differ?',
            },
          ],
        },
      ],
    },
    {
      id: 'capstone',
      title: 'Capstone: the full autonomous',
      items: [
        {
          kind: 'reading',
          title: 'The build brief',
          blocks: [
            { t: 'p', md: 'Everything from units 1–8, one tree. The robot: **drive from A to B, intake a game piece, aim, and shoot twice through a Timeout shield; the whole plan aborts instantly if the gyro says not-static (reactive guard)**. Mock commands (all `command`-def mocks with ms ports): `DrivePath` (1200 ms), `Intake` (500 ms), `AimFrom` (400 ms, two shots allowed without re-aiming), `Shoot` (250 ms each).' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'target shape', code: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <ReactiveSequence name="GyroGuard">
        <GyroSafe/>
        <DrivePath ms="1200"/>
      </ReactiveSequence>
      <Intake ms="500"/>
      <SequenceWithMemory name="Fire">
        <AimFrom ms="400"/>
        <Timeout msec="700">
          <Sequence>          <!-- decorators have EXACTLY one child: pair the shots here -->
            <Shoot/>
            <Shoot/>
          </Sequence>
        </Timeout>
      </SequenceWithMemory>
    </Sequence>
  </BehaviorTree>
</root>` },
            { t: 'list', items: [
              'Requirement: BOTH shots happen (Shoot twice), so the Timeout wrapping the pair must allow ~700 ms — the second shot alone is 250.',
              'Guard: GyroSafe re-asks against `bb.gyroOk` (the sim drops it mid-run only if you tell it to — capstone version does NOT — keep it simple)',
              'Memory: SequenceWithMemory keeps AimFrom from re-running between the two Shots.',
            ] },
            { t: 'warn', md: 'If `Repeat` lives inside a Timeout deadline too close, a single child run consuming the whole window drops your second shot. Budget: 2×250 ms of Shoot + margins < the Timeout deadline.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Ship the autonomous',
          workspace: {
            brief: 'From a mostly-blank canvas, produce the auto above. The grader runs your tree with yellow flags on: **intake the piece, aim once, shoot twice, all inside a Timeout(700) around the two shots; drive first under the reactive gyro guard**.',
            tasks: [
              'ReactiveSequence: GyroSafe + DrivePath(1200 ms)',
              'Intake after driving (500 ms)',
              'THEN: SequenceWithMemory containing AimFrom(400) and a Timeout(700) wrapping a <Sequence> of TWO <Shoot/> leaves (decorators take exactly one child — pair the shots inside a Sequence)',
              'Plan must end SUCCESS by tick 60 (sim budget ≈ 57)',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">

    <!-- your capstone plan here -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <ReactiveSequence>
        <GyroSafe/>
        <DrivePath ms="1200"/>
      </ReactiveSequence>
      <Intake ms="500"/>
      <SequenceWithMemory>
        <AimFrom ms="400"/>
        <Timeout msec="700">
          <Sequence>
            <Shoot/>
            <Shoot/>
          </Sequence>
        </Timeout>
      </SequenceWithMemory>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 70,
            nodes: {
              GyroSafe: { type: 'condition', tick: (ctx) => (ctx.blackboard.get('gyroOk','int') > 0 ? 'SUCCESS' : 'FAILURE') },
              DrivePath: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '1200' }], supplier: command(1200) },
              Intake: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '500' }], supplier: command(500) },
              AimFrom: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '400' }], supplier: command(400) },
              Shoot: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '250' }], supplier: command(250) },
            },
            beforeTick: (runner) => {
              scheduler.step(runner);
              if (!runner.blackboard.tryGet('gyroOk').present) runner.blackboard.set('gyroOk', 1);
            },
            validators: [
              { label: 'guard re-asked while driving (≥ 10 ticks)', check: (api) => api.ticksOf('GyroSafe') >= 10 || `GyroSafe asked ${api.ticksOf('GyroSafe')} times` },
              { label: 'path completed', check: (api) => api.lastReturnOf('DrivePath') === 'SUCCESS' || 'DrivePath never finished' },
              { label: 'intake collected', check: (api) => api.lastReturnOf('Intake') === 'SUCCESS' || 'Intake never finished' },
              { label: 'aim happened once (9 ticks: start + 8 polls)', check: (api) => api.ticksOf('AimFrom') === 9 || `AimFrom ticked ${api.ticksOf('AimFrom')} times — memory should keep it to a single run` },
              { label: 'both Shot leaves fired inside their Timeout', check: (api) => api.tally.filter((t) => t.name === 'Shoot').reduce((n, t) => n + t.count, 0) >= 12 || 'two Shoot leaves, each 6 ticks' },
              { label: 'tree SUCCESS by tick 60', check: (api) => api.status === 'SUCCESS' && api.tickIndex <= 60 || `ended ${api.status ?? 'none'} at tick ${api.tickIndex}` },
            ],
            hints: [
              'Shoot twice means literally two <Shoot/> leaves inside one <Sequence> (decorators take exactly one child).',
              'Timeout(700) covers the PAIR through that Sequence — 250 + 250 ms plus idle slack.',
              'SequenceWithMemory wraps AimFrom + Timeout so a timeout-failure never re-runs the aim.',
            ],
          },
        },
        {
          kind: 'java',
          title: 'Ship it to the robot',
          blocks: [
            { t: 'p', md: 'The deploy story (all in the repo\'s example project — `examples/wpilib-robot-example`):' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'deploy/autonomous.xml', code: '<root BTCPP_format="4" main_tree_to_execute="Auto">\n  <BehaviorTree ID="Auto">\n    <Sequence>\n      <Intake/>\n      <Timeout msec="4000">\n        <Shoot/>\n      </Timeout>\n    </Sequence>\n  </BehaviorTree>\n</root>' },
            { t: 'list', items: [
              '`WpilibNodes.registerCommandAction(factory, "Intake", …)` once per leaf id in `RobotContainer` (constructor).',
              '`createTreeFromFile(deploy/autonomous.xml)` — the file lives in `src/main/deploy/`, lands on the roboRIO with the deploy target driver.',
              '`getAutonomousCommand()` returns `new BehaviorTreeCommand(autonomousTree, intakeSubsystem, shooterSubsystem)` — requirements declared, scheduling periodic.',
              'Optional: `new NTBehaviorTreeLogger(autonomousTree, …)` + close() when switching to teleop.',
              'New XML between matches: no rebuild — just deploy the file (or keep several `<BehaviorTree>` IDs and switch `main_tree_to_execute` from a dashboard input).',
            ] },
            { t: 'tip', md: 'This ends the spiral: you went from one XML line to a full deploy pipeline. Keep `AGENT`-fact fidelity notes in mind — the simulator mirrors all of this including type-locks, halts and scripts. Happy roboting!' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Final check',
          questions: [
            {
              q: 'You need a fresh autonomous on the field. What must you re-deploy at minimum?',
              options: [
                'A rebuilt robot jar — trees are compiled in',
                'Just the XML file in src/main/deploy/ (tree shape), since node types and wiring are already on the robot',
                'Nothing; the tree self-modifies from the blackboard',
              ],
              correct: 1,
              explain: 'Trees are data. The node library (registered in RobotContainer) stays fixed in the jar; the deploy/xml drives what runs — that split is the reason BT.CPP took over FRC autonomous code.',
              hint: 'Which part of the system did BehaviorTree.java push into files?',
            },
            {
              q: 'In the capstone tree, the second Shoot would time out if Timeout msec="550". Why might the FIRST run still succeed?',
              options: [
                'the first shot is faster than the deadline — but the second will fail and the branch report FAILURE, losing the fire',
                'Timeout quietly extends itself',
                'Both shots fit in 550 ms due to tick batching',
              ],
              correct: 0,
              explain: 'The deadline covers the PAIR. First shot 250 ms → fine; the second must fully finish before the deadline sweep. Budget ms carefully (and remember the sim anchor: deadlines measured in 50 ms ticks).',
              hint: 'A Timeout protects its whole subtree — recursively.',
            },
          ],
        },
      ],
    },
  ],
};
