// UNIT 2 — Writing Trees in XML. root/BehaviorTree/main_tree_to_execute, one-child rule,
// compact vs explicit tags, Sequence + Fallback with conditions, and how the Java factory loads
// and ticks a tree (createTreeFromFile / tickOnce / tickWhileRunning).

/* Simulated CommandScheduler (same pattern as unit 1). */
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
/** A mock WPILib command that finishes after `ms` simulated milliseconds. */
const timedCmd = (defMs, name = 'ms') => (ctx) => {
  const c = { _scheduled: true, left: Math.ceil(msOf(ctx, name, defMs) / 50) };
  c.update = () => { c.left -= 1; if (c.left <= 0) c._scheduled = false; };
  sched.add(c); return c;
};

export default {
  id: 2,
  color: '#f65a5b',
  title: 'Writing Trees in XML',
  tagline: 'Describe a robot’s brain in a portable, readable XML tree.',
  lessons: [
    {
      id: 'root-format',
      title: 'The anatomy of valid tree XML',
      items: [
        {
          kind: 'reading',
          title: 'root → BehaviorTree → exactly one child',
          blocks: [
            { t: 'p', md: 'Everything sits inside a `<root>` element (mirroring `XmlTreeBuilder` upstream). Inside, one or more `<BehaviorTree>` **definitions** get an `ID`, and `<root main_tree_to_execute="...">` names which one actually runs.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'minimal.xml', code: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <AlwaysSuccess/>
  </BehaviorTree>
</root>` },
            { t: 'list', items: [
              'A `<BehaviorTree>` must have **exactly one child** — the root node of that tree. Two siblings under it is a build error, not a warning.',
              'Useful comments and whitespace are fine; the parser skips them like upstream does.',
              'If there is exactly **one** `<BehaviorTree>` and no `main_tree_to_execute`, that tree runs; once you have several definitions the attribute is mandatory.',
              '`BTCPP_format="4"` is just the format version stamp — keep it, it documents the dialect.',
            ] },
            { t: 'warn', md: '`<!DOCTYPE …>` is **rejected** by the parser (upstream hardens against XXE). Never copy DOCTYPE boilerplate from web examples.' },
            { t: 'p', md: 'One `<root>` may hold several `<BehaviorTree>` definitions — useful when the main tree calls subtrees (unit 7):' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'multi.xml', code: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <SubTree ID="Pickup"/>
  </BehaviorTree>

  <BehaviorTree ID="Pickup">
    <Sequence>
      <Intake ms="300"/>
      <Clamp/>
    </Sequence>
  </BehaviorTree>
</root>` },
          ],
        },
        {
          kind: 'exercise',
          title: 'Fix the broken tree',
          workspace: {
            brief: 'This tree was written in a hurry and does not build. Repair it so the robot **intakes, then shoots** — same plan as unit 1, but from a skeleton full of mistakes.',
            tasks: [
              'The root attribute naming the main tree is misspelled',
              'A flow node is spelled wrong (`Sequance`)',
              'One action ID is not registered at all — the real library has `Shoot` (with no ports)',
              'The engine error messages name the exact problem: read them!',
            ],
            startXml: `<root BTCPP_format="4" mai_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequance>
      <Intake ms="300"/>
      <CoolShooter ms="300"/>
    </Sequance>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <Intake ms="300"/>
      <Shoot/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 120,
            nodes: {
              Intake: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '300' }], supplier: timedCmd(300) },
              Shoot: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '300' }], supplier: timedCmd(300) },
            },
            beforeTick: (runner) => sched.step(runner),
            validators: [
              { label: 'Tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended with ${api.status ?? 'nothing'}` },
              { label: 'Intake then Shoot, both completed', check: (api) => (api.lastReturnOf('Intake') === 'SUCCESS' && api.lastReturnOf('Shoot') === 'SUCCESS') || 'both Intake and Shoot must end SUCCESS' },
            ],
            hints: [
              '`mai_tree_to_execute` → the real attribute is `main_tree_to_execute`.',
              '`Sequance` → `Sequence`. Registered IDs are case-sensitive and spelled in English!',
              'The action ID `CoolShooter` is not registered anywhere; the registered ID here is `Shoot` (its `ms` port is optional).',
              '<Shoot ms="...">' + ' would be rejected — Shoot declares no ports at all.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Which of these is INVALID XML for this engine?',
              options: [
                'Two <BehaviorTree> definitions inside one <root>',
                '<root> with no main_tree_to_execute when exactly one <BehaviorTree> exists',
                'Two siblings directly under <BehaviorTree>',
                'Extra whitespace and comments between elements',
              ],
              correct: 2,
              explain: 'A BehaviorTree must have exactly ONE root child — siblings are a build error (that is a uniqueness guarantee the parser also enforces on <root>, entirely by design like BT.CPP).',
              hint: 'Think about what "the tree" means: exactly one starting point.',
            },
          ],
        },
      ],
    },
    {
      id: 'compact-explicit',
      title: 'Compact vs explicit tags',
      items: [
        {
          kind: 'reading',
          title: 'Two spellings for the same node',
          blocks: [
            { t: 'p', md: '`<Intake/>` is syntax sugar for an **explicit class tag**. These two are identical to the parser:' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'two spellings', code: `<Action ID="Intake" name="take_game_piece"/>   <!-- explicit -->
<Intake name="take_game_piece"/>                    <!-- compact -->` },
            { t: 'p', md: 'Explicit tags don\'t even imply the node type — `<Action>`, `<Condition>`, `<Control>`, `<Decorator>` route through the same registration lookup by `ID`. They matter when an XML generator (or subtree loader) is laying out nodes with a fixed template, and they make an XML "node-type-agnostic".' },
            { t: 'table', cols: ['Shorthand', 'Equivalent'], rows: [
              ['<Foo/>', '<Action ID="Foo"/> (allocated NodeClass by type — the factory infers ACTION if Foo is not a control)… except control builtins: <Sequence/> is also written compactly'],
              ['<BallLoaded/>', '<Condition ID="BallLoaded"/>'],
              ['<Fallback>', '<Control ID="Fallback">'],
              ['<RetryUntilSuccessful>', '<Decorator ID="RetryUntilSuccessful"> (also aliased <Retry>)'],
            ] },
            { t: 'note', md: 'Node **names** are optional. Without `name="…"`, a node is named after its registration ID — its generated full path is like `root/Sequence/Intake`.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick check',
          questions: [
            {
              q: '<Condition ID="BallLoaded"/> and <BallLoaded/> are…',
              options: [
                'different: one must be registered differently',
                'the same node — compact spelling is desugared to the explicit tag',
                'invalid — conditions must always be written with a name attribute',
              ],
              correct: 1,
              explain: 'The parser routes both through the same registration by ID. The explicit form exists for XML tooling and strict templates.',
              hint: 'One is sugar for the other.',
            },
          ],
        },
      ],
    },
    {
      id: 'fallback',
      title: 'Fallback: try things, keep the questions honest',
      items: [
        {
          kind: 'reading',
          title: 'Sequence = AND, Fallback = OR',
          blocks: [
            { t: 'p', md: 'A `Sequence` ticks children in order and stops at the first **FAILURE** — it is the tree\'s "AND". A **`Fallback`** is the "OR": it ticks children in order and stops at the first **SUCCESS**.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'pickup-with-plan-b.xml', code: `<Fallback>
  <BallLoaded/>
  <Sequence>
    <DriveTo ms="600"/>
    <Intake ms="400"/>
  </Sequence>
</Fallback>` },
            { t: 'p', md: 'Read that as: "if a ball is already loaded, we\'re done. Otherwise drive over and grab one." Make sure you never bury a slow-moving action directly in a Fallback *without* a cheapskate condition first — every FAILURE of the first candidate re-ticks candidates from the start. Driving backwards can happen.' },
            { t: 'tip', md: 'DO put cheap conditions first. DO sequence "costly to recover" actions early in a Sequence. DON\'T put two commands both mutating the same subsystem inside one Fallback — a Fallback might tick both alternately across ticks.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Build the pickup plan',
          workspace: {
            brief: 'Drive picks up a note when one is loaded, **otherwise** drive over and intake one. Sensors this time: `BallLoaded` (a condition), mechanisms `DriveTo`, `Intake`, both command-driven. Build the Fallback structure from the reading.',
            tasks: [
              'Use a `<Fallback>` with `BallLoaded` as the first child',
              'Then a `<Sequence>` of `DriveTo` (600 ms) + `Intake` (400 ms)',
              'The tree must finish by tick 30 (1.5 s), SUCCESS',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Pickup">
  <BehaviorTree ID="Pickup">

    <!-- Fallback: BallLoaded OR (DriveTo then Intake) -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Pickup">
  <BehaviorTree ID="Pickup">
    <Fallback>
      <BallLoaded/>
      <Sequence>
        <DriveTo ms="600"/>
        <Intake ms="400"/>
      </Sequence>
    </Fallback>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              BallLoaded: { type: 'condition', tick: (ctx) => (ctx.blackboard.get('cargo','int') > 0 ? 'SUCCESS' : 'FAILURE') },
              DriveTo: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '500' }], supplier: timedCmd(600) },
              Intake: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '400' }], supplier: timedCmd(400) },
            },
            beforeTick: (runner) => { sched.step(runner); runner.blackboard.set('cargo', 0); },
            validators: [
              { label: 'Tree finished SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
              { label: 'BallLoaded condition was asked', check: (api) => api.ticksOf('BallLoaded') >= 1 || 'the Fallback never asked BallLoaded' },
              { label: 'DriveTo ran before Intake', check: (api) => (api.lastReturnOf('DriveTo') === 'SUCCESS' && api.lastReturnOf('Intake') === 'SUCCESS') || 'both DriveTo and Intake must run' },
            ],
            hints: [
              'A Fallback stops at the first SUCCESS — put the cheap condition first.',
              'Nested sequence: <Fallback><BallLoaded/><Sequence><DriveTo ms="600"/><Intake ms="400"/></Sequence></Fallback>',
              'BallLoaded silently reads the blackboard\'s `cargo`; the harness starts it at 0, so the condition fails and plan B runs.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'A wants-shoot tree is `<Fallback><BallLoaded/><Sequence><DriveTo/><Intake/></Sequence></Fallback>`. `BallLoaded` FAILS; the sequence ticks, `DriveTo` returns RUNNING. When does `BallLoaded` get asked again?',
              options: [
                'Every tick, even while DriveTo is RUNNING',
                'Never again — the Fallback committed to child 2',
                'When DriveTo eventually succeeds',
              ],
              correct: 1,
              explain: 'That is plain Fallback: once a RUNNING child owns the tick, earlier siblings are skiped entirely. Re-asking while a plan runs is the job of the REACTIVE variant — unit 6.',
              hint: 'A "plain" Fallback commits; only reactive siblings re-evaluate continuously.',
            },
          ],
        },
      ],
    },
    {
      id: 'java-run',
      title: 'Java: building, ticking, halting',
      items: [
        {
          kind: 'java',
          title: 'Code study: the runtime loop',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'your_robot.java', code: `BehaviorTreeFactory factory = new BehaviorTreeFactory();  // built-ins pre-registered
factory.registerNodeType("DriveTo", MyDriveNode.class);    // your custom nodes (unit 3)

Tree tree = factory.createTreeFromFile(Path.of("deploy", "auto_pickup.xml"));

NodeStatus s = tree.tickOnce();        // one step — exactly what WPILib does per periodic
while (s == NodeStatus.RUNNING) {
    s = tree.tickWhileRunning(20);     // same, but sleeps approx sleepMillis between ticks
}
tree.haltTree();                       // force any still-RUNNING node (and its children) to stop` },
            { t: 'list', items: [
              '`tickOnce()` — one traversal; the right call inside a Wpilib periodic loop, because *you* decide the cadence.',
              '`tickWhileRunning(ms)` — convenience for quick standalone tests: keeps ticking while the root is RUNNING, sleeping between ticks. The Java port keeps it because BT.CPP has it; on an FRC robot you would normally use a separate thread instead.',
              '`haltTree()` — walks every node; RUNNING children receive their halt callbacks (onHalted for StatefulActionNodes, and post-condition `_onHalted` scripts). Control and decorator nodes reset.',
            ] },
            { t: 'note', md: 'BehaviorTreeCommand (unit 9) does *exactly* this: `initialize()` resets the root, `execute()` runs `tickOnce()` once per scheduler cut, `isFinished()` is true on root SUCCESS/FAILURE, and `end()` calls `tree.haltTree()`.' },
            { t: 'table', cols: ['Scenario', 'Right tool'], rows: [
              ['Autonomous routine on the roboRIO', '`BehaviorTreeCommand` (one tickOnce per periodic)'],
              ['Unit test or bench sim on the laptop', '`tickWhileRunning(20)` / `tickOnce()` loop'],
              ['Cancel a partial autonomous (cancel button)', 'Command `cancel()` → `end(true)` → `haltTree()`'],
            ] },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'An autonomous command is cancelled mid-run by the driver station while `DriveTo` returned RUNNING. Which pair of things must happen?',
              options: [
                'The tree rebuilds from disk, then ticks again',
                '`end(true)` runs `haltTree()` so DriveTo\'s onHalted() fires, stopping motors',
                'The battery is polled for faults and the Command shuts down subsystems',
              ],
              correct: 1,
              explain: 'haltTree() hooks every still-RUNNING node — custom nodes get their halt() override and their onHalted(); WPILib Commands get cancelled by CommandActionNode.onHalted(). Without it a motor can keep spinning.',
              hint: 'What does a robot do when a plan vaporizes mid-turn?',
            },
            {
              q: 'What is the difference between createTreeFromText and registerBehaviorTreeFromText?',
              options: [
                'They are synonyms',
                'register… stores a <BehaviorTree> definition for later SubTree calls; create… builds a ready-to-tick Tree',
                'register… is for arrays of trees; create… for single-tree files',
              ],
              correct: 1,
              explain: 'register*() adds tree definitions into the factory (subtree usable later by ID); create*() goes all the way to a instantiated Tree.',
              hint: 'One of them is a database, the other is a product.',
            },
          ],
        },
      ],
    },
  ],
};
