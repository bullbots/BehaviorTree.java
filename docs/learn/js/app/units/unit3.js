// UNIT 3 — Your Own Nodes (Java). Real SyncActionNode subclasses, the (String, NodeConfig) ctor,
// providedPorts()/Port.list, registerNodeType by reflection, SimpleActionNode lambdas, and the
// ConditionNode rules.
const msOf = () => 0; // (ports helpers added where exercises need them; unit 3 exercises are XML-port focused)
export default {
  id: 3,
  color: '#7a5ef0',
  title: 'Your Own Nodes (Java)',
  tagline: 'Write custom actions and conditions in Java — no annotations, just ports.',
  lessons: [
    {
      id: 'sync-action',
      title: 'A custom action, top to bottom',
      items: [
        {
          kind: 'java',
          title: 'Code study: SyncActionNode',
          blocks: [
            { t: 'p', md: 'A node that finishes in a single tick subclasses **`SyncActionNode`**, gets a public `(String name, NodeConfig config)` constructor, declares its ports in `providedPorts()` **as a static method** (BehaviorTree.java has no annotations!), and does the work in `tick()`.' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'PrintValueNode.java', code: `public class PrintValueNode extends SyncActionNode
{
  public PrintValueNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  public static PortsList providedPorts()
  {
    return Port.list(
        Port.input(String.class, "message", "text to print on the driver station console"));
  }

  @Override
  protected NodeStatus tick()
  {
    String msg = getInput("message", String.class);
    System.out.println(fullPath() + ": " + msg);
    return NodeStatus.SUCCESS;
  }
}` },
            { t: 'list', items: [
              '`getInput("message", String.class)` pulls a port value: a **literal** printed in XML (`message="hi"`), or a **blackboard pointer** (`message="{note}"`) resolved by the engine.',
              'The node returns a `NodeStatus` — for a sync action one of SUCCESS / FAILURE / SKIPPED. Returning RUNNING from a sync action is a LogicError (the base class enforces it).',
              '`fullPath()` gives the tree-local address of this instance, like `Auto/Sequence/PrintValue`.',
            ] },
            { t: 'warn', md: 'Java reflection contract: the class needs **one public constructor `(String, NodeConfig)`** and (if it has ports) a **`public static PortsList providedPorts()`**. Get the constructor wrong and `registerNodeType` throws at REGISTRATION time with a helpful message — by design, so it fails on the laptop, not on the field.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'How does a custom node declare that it has an input port?',
              options: [
                'Annotate the field with @Port(name="message")',
                'public static PortsList providedPorts() returning Port.list(Port.input(...))',
                'Ports are always inferred from the constructor parameters',
              ],
              correct: 1,
              explain: 'BehaviorTree.java deliberately follows BT.CPP v4: ports are declared in a static providedPorts() method. No annotations, no reflection scanning of fields.',
              hint: 'Think "static factory of the node\'s manifest".',
            },
            {
              q: 'Your SyncActionNode\'s tick() has nothing left to do after it returns SUCCESS. What does the parent see next tick?',
              options: [
                'The node is ticked again from scratch',
                'Once the node reports a status that is done, the parent rewinds and the node goes back to IDLE',
                'The node caches SUCCESS until the tree restarts',
              ],
              correct: 1,
              explain: 'A plain Sequence resets finished children immediately; the child\'s status returns to IDLE and a fresh tick would start it over. If you need "remember: done", use RunOnce (unit 6) or plan memory (unit 5).',
              hint: 'Sync nodes do not carry state across ticks unless you add it.',
            },
          ],
        },
      ],
    },
    {
      id: 'ports',
      title: 'Ports: the public interface of a node',
      items: [
        {
          kind: 'reading',
          title: 'Dir, type, default, description',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'DriveDistanceNode.java', code: `public static PortsList providedPorts()
{
  return Port.list(
      Port.input(Double.class, "distance", 1.0, "meters forward"),
      Port.output(Boolean.class, "reached", "true once the robot settled"),
      Port.input(String.class, "name", "drive"));
}` },
            { t: 'table', cols: ['Piece', 'Meaning'], rows: [
              ['`Port.input(Type, name)`', 'reads at tick time — direction IN grows the mandatory-port checking story'],
              ['`Port.input(Type, name, default, desc)`', 'shows a default in the manifest; passing the port in XML becomes optional'],
              ['`Port.output(Type, name, desc)`', 'the node writes: XML must bind it to a blackboard pointer `{key}`'],
              ['`Port.inout(...)`', 'reads AND writes (e.g. unit-7 style queues)'],
            ] },
            { t: 'p', md: 'Under the hood every node has a `NodeConfig` per instance with three keyed bags: `inputPorts`, `outputPorts` and `otherAttributes`. The factory classifies the XML attributes for you: an attribute that names a **declared input** becomes a port literal-or-pointer; renaming an **output** to something not declared {pointer} gets an error; spelling an attribute the node never declared is an XML build error — exactly like upstream.' },
            { t: 'p', md: 'In the simulator you\'ll meet Java ports all the time: exercise "nodes" live as a JAVALIKE manifest + one JS function per behavior. Try it below: the `MoveBy` node wants one `distance` input and reports one `arrived` output — your XML needs both, wired through the blackboard.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Wire a custom node\'s ports',
          workspace: {
            brief: 'The robot has the custom `MoveBy` action (below in your task list). Its ports: **input `distance`** (double, meters), **output `arrived`** (written once the move ends). Wire it so the tree reads the literal `2.5` (meters), and binds `arrived` to a blackboard key.',
            tasks: [
              'Instantiate <MoveBy distance="2.5" arrived="{arrived}"/>',
              'Keep main_tree_to_execute="Main"',
              'Run & check: the blackboard must show `arrived` afterwards',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">

    <!-- MoveBy with a literal input and an output bound to {arrived} -->

  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <MoveBy distance="2.5" arrived="{arrived}"/>
  </BehaviorTree>
</root>`,
            maxTicks: 120,
            nodes: {
              MoveBy: {
                type: 'action',
                ports: [
                  { dir: 'input', name: 'distance', type: 'double' },
                  { dir: 'output', name: 'arrived', type: 'bool' },
                ],
                tick: (ctx) => { ctx.setOutput('arrived', true); return 'SUCCESS'; },
              },
            },
            validators: [
              { label: 'input port parsed as double 2.5', check: (api) => api.get('arrived') === true || 'arrived must end up true on the blackboard' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'Output ports are XML attributes in brackets: arrived="{arrived}".',
              'Literals keep type info going in — distance="2.5" parses as double like Java\'s Conversion pipeline.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'You write `<MoveBy dist="2.5"/>` but the Java node declared the port as `distance`. What happens?',
              options: [
                'The port is silently renamed',
                'A build error: Attribute \'dist\' is not a declared port of \'MoveBy\'',
                'dist becomes an "other attribute" the node can ignore',
              ],
              correct: 1,
              explain: 'The factory refuses undeclared attributes — the same error you would see on a real roboRIO log at createTreeFromFile(). Typos in port names are caught at start-up.',
              hint: 'Same policy as an unknown node ID: fail fast at build.',
            },
          ],
        },
      ],
    },
    {
      id: 'register',
      title: 'Registration & simple nodes',
      items: [
        {
          kind: 'java',
          title: 'Code study: every way to register a node',
          blocks: [
            { t: 'p', md: '**Full class (recommended for the drive team library):**' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'RobotContainer.java', code: `factory.registerNodeType("MoveBy", MoveByNode.class);
// reflection finds (String, NodeConfig) + static providedPorts(), infers ACTION/CONDITION/…

factory.registerSimpleAction("Print", (TreeNode n) -> {
    System.out.println(n.fullPath());
    return NodeStatus.SUCCESS;             // SimpleActionNode, lambda syntax
});

factory.registerSimpleCondition("BallLoaded", (TreeNode n) ->
    intakeSubsystem.hasNote() ? NodeStatus.SUCCESS : NodeStatus.FAILURE);

factory.registerNodeType("OVerload", PortsList.of(),
    NodeType.ACTION,
    (name, config) -> new SyncActionNode(name, config) { ... });  // full builder escape hatch` },
            { t: 'list', items: [
              '**`registerNodeType(id, Class)`** — reflection: reads ctor + static providedPorts; type-auto-inferred from which base class you extend.',
              '**`registerSimpleAction/registerSimpleCondition`** — one lambda, no class file. Built on `SimpleActionNode` / `SimpleConditionNode`.',
              '**Full builder `registerNodeType(id, ports, type, builder)`** — you provide the manifest and instance factory yourself. Tune when a node needs runtime wiring (subsystem handles, ports from a Command, and `WpilibNodes.registerCommandAction` uses exactly this).',
            ] },
            { t: 'warn', md: 'Conditions made through registerSimpleCondition must still not return RUNNING. `ConditionNode` (the base class) does not enforce it here by itself — that is the developer\'s contract, and ReactiveSequence relies on the promise.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What does registerNodeType do with your class?',
              options: [
                'Instruments its bytecode with the BT runtime',
                'Finds the public (String, NodeConfig) ctor + the static providedPorts() and stores a builder record',
                'Creates one instance right away and pools it for ticks',
              ],
              correct: 1,
              explain: 'Nothing is instantiated at registration: reflection only reads. Instances are built per-tick needs by the factory when a tree is created — one fresh instance per XML use-site, like BT.CPP.',
              hint: 'Registration is cataloguing; building is later, per tree.',
            },
          ],
        },
      ],
    },
  ],
};
