// UNIT 4 — Data on the Blackboard. Ports remapped by {pointers}, literals, SetBlackboard,
// <Script>, type-lock (why it throws, Java-faithful), safe numeric casts, @root escape, {=} alias.
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };
const timedCmd = (defMs, name = 'ms') => (ctx) => {
  const c = { _scheduled: true, left: Math.ceil(msOf(ctx, name, defMs) / 50) };
  c.update = () => { c.left -= 1; if (c.left <= 0) c._scheduled = false; };
  return c;
};
export default {
  id: 4,
  color: '#e8a13c',
  title: 'Data on the Blackboard',
  tagline: 'Move values between nodes with typed ports and a type-locked blackboard.',
  lessons: [
    {
      id: 'pointers',
      title: 'Literals and {pointers}',
      items: [
        {
          kind: 'reading',
          title: 'Ports read text; the blackboard stores values',
          blocks: [
            { t: 'p', md: 'XML attributes are **strings**. `distance="2.5"` is converted to a Java `Double` (`double`) at tick time; `message="hello"` stays a string. When you want a port to read a **variable** instead, wrap it in braces — `{distance}` is a **blackboard pointer**:' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'pointers.xml', code: `<Sequence>
  <Script code="distance := 2.5"/>
  <MoveBy distance="{distance}" arrived="{done}"/>
  <CheckReached reached="{done}"/>   <!-- another node READS what MoveBy wrote -->
</Sequence>` },
            { t: 'p', md: 'Same port, two data source machinery: `2.5` is a literal; `{done}` books an address at `Blackboard["done"]`. Writing to an output port **stores** a value in the blackboard (creating the entry on first write); reading an input pointer **fetches** it — and if the key was never written, you get a Runtime "missing key" at tick time, matching upstream.' },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'TreeNode.java excerpt', code: `// node.getInput(key, T) mirrors this pseudo-code:
//  1. literal from the XML?  -> parse it as T
//  2. "{pointer}"?           -> value = blackboard.get(pointerName, T)
//  3. none of the above?     -> manifest default, else throw "missing key"` },
            { t: 'tip', md: 'One convention worth adopting: names like `game_piece_count` (snake_case) read well in Groot-style tools, because the blackboard key shares the namespace with port names.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Relay a value between two nodes',
          workspace: {
            brief: 'The shooter needs to know the distance **after** the drivetrain computed it. Two custom nodes exist: `ComputeDistance` (output `meters`) and `AimShooter` (input `distance` — in this sim it reports back what it read). Node A writes, node B reads: connect them with the blackboard.',
            tasks: [
              'Run `ComputeDistance` first (its built-in output is a literal `4.5` here)',
              'Then `AimShooter` with its `distance` input pointing at the SAME blackboard key',
              'Run & check: the sim must record `AimShooter` saw `4.5`',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>

    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <ComputeDistance meters="{meters}"/>
      <AimShooter distance="{meters}"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              ComputeDistance: {
                type: 'action',
                ports: [{ dir: 'output', name: 'meters', type: 'double' }],
                tick: (ctx) => { ctx.setOutput('meters', 4.5); return 'SUCCESS'; },
              },
              AimShooter: {
                type: 'action',
                ports: [{ dir: 'input', name: 'distance', type: 'double' }],
                tick: (ctx) => { ctx.blackboard.set('aimRead', ctx.getInput('distance','double')); return 'SUCCESS'; },
              },
            },
            validators: [
              { label: 'AimShooter read exactly 4.5', check: (api) => api.get('aimRead') === 4.5 || `aimRead is ${api.get('aimRead')}` },
              { label: 'the key was written by ComputeDistance', check: (api) => typeof api.tryGet('meters') === 'number' || 'meters was never stored' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'XML: <ComputeDistance meters="{meters}"/> — meters is its OUTPUT port.',
              'XML: <AimShooter distance="{meters}"/> — the pointer names the blackboard key, not the port.',
              'Order matters: compute, then aim. Sequence guarantees it.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'When does a missing blackboard pointer (a key nobody ever wrote) fail?',
              options: [
                'At XML build time',
                'At tick time when the port reads it — "RuntimeError: get() error. Missing key [key]"',
                'It never fails; it reads 0',
              ],
              correct: 1,
              explain: 'The XML is structurally fine. Only the tick that fetches the value discovers that nothing stores it — Java-faithful late binding with an explicit runtime error.',
              hint: 'Building a tree is only about shape; values are runtime.',
            },
          ],
        },
      ],
    },
    {
      id: 'setb-script',
      title: 'SetBlackboard and <Script>',
      items: [
        {
          kind: 'reading',
          title: 'Two built-ins that write',
          blocks: [
            { t: 'code', lang: 'xml', name: 'XML', file: 'writers.xml', code: `<SetBlackboard value="45" output_key="rpm"/>
<Script code="rpm := rpm + 15"/>
<Script code="ready := rpm > 50"/>` },
            { t: 'list', items: [
              '`SetBlackboard` — one literal write, visible enough to be self-documenting.',
              '`<Script>` — a tiny scripting language (unit 8). Inside a script, `x := v` **creates or overwrites** the entry; `x = v` assigns ONLY if `x` already exists (creating silently with `=` upstream is a classic typo — the engine throws to remind you).',
              'Both write through the same `Blackboard.set(...)` — same type-lock, same counts.',
            ] },
            { t: 'note', md: 'Scripts evaluate left-to-right and return the LAST statement\'s value. They are single expressions + assignments — no loops, no functions. For anything bigger, write it in Java (unit 3).' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Build a warmup counter',
          workspace: {
            brief: 'JSON-free logic inside XML: seed `rpm` to **0**, then run `Warmup` (a stateful node that bumps motor speed 15 per tick while RUNNING) until it reports done, then record `ready := 1`.',
            tasks: [
              'Script 1: `rpm := 0` BEFORE Warmup',
              'Script 2: `ready := 1` AFTER Warmup',
              'Don\'t use `=` (equals) for the first write — Warmup reads rpm and the sim type-locks it',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Warmup">
  <BehaviorTree ID="Warmup">
    <Sequence>

    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Warmup">
  <BehaviorTree ID="Warmup">
    <Sequence>
      <Script code="rpm := 0"/>
      <Warmup/>
      <Script code="ready := 1"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              Warmup: {
                type: 'stateful',
                onStart: (ctx) => { return ctx.blackboard.get('rpm','double') < 60 ? 'RUNNING' : 'SUCCESS'; },
                onRunning: (ctx) => { const rpm = ctx.blackboard.get('rpm','double'); ctx.blackboard.set('rpm', rpm + 15); ctx.log('[Warmup] rpm → ' + (rpm + 15)); return rpm + 15 >= 60 ? 'SUCCESS' : 'RUNNING'; },
              },
            },
            validators: [
              { label: 'rpm ended at (least) 60', check: (api) => api.get('rpm') >= 60 || `rpm = ${api.get('rpm')}` },
              { label: 'ready written exactly once, AFTER running', check: (api) => (api.get('ready') === 1 && api.ticksOf('Warmup') >= 4) || 'Warmup should have ramped before ready:=1' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'The Warmup simulation gets faster by pushing rpm +15 each onRunning; SUCCESS once rpm ≥ 60.',
              'Type-lock: `rpm := 0` declares rpm as a whole-number entry — keep all later writes whole numbers, or start with `rpm := 0.0`.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'In a script, what is the difference between `rpm := 55` and `rpm = 55`?',
              options: [
                'none — both create the entry',
                '`:=` creates or overwrites; `=` requires that the entry already exists, otherwise an error',
                '`:=` only works with numbers',
              ],
              correct: 1,
              explain: 'This mirrors BT.CPP exactly (operator := current value-create semantics). The `=`-on-missing error is a beloved typo catcher: ports that "half-work" get caught the first tick, in the sim, not on the robot.',
              hint: 'The colon means "make it first".',
            },
          ],
        },
      ],
    },
    {
      id: 'type-lock',
      title: 'Type-lock & safe casts',
      items: [
        {
          kind: 'reading',
          title: 'Once declared, the type of a port shall not change',
          blocks: [
            { t: 'p', md: 'Every `Blackboard.set(key, value)` in the Java port is strongly typed from the first typed write. The rule is verbatim upstream: **"once declared, the type of a port shall not change."** Hand-written ports lock from `createEntry` (via manifests); a script\'s first write infers the type too (`rpm + 15` → double; scripts have no booleans at all — `true` is just the double `1.0`).' },
            { t: 'table', cols: ['Declared type', 'Later write', 'Verdict'], rows: [
              ['`int x := 3`', '`x = 3.5`', '**.LogicError** — 3.5 is not "unchanged-safe" for an int entry'],
              ['`int x := 3`', '`x = 2.0`', 'allowed — `NumericCast.isSafe(int, 2.0)`: it is mathematically 2'],
              ['`double d := 2.5`', '`d = 3`', 'allowed — int widens into a double port'],
              ['`string s := "hi"` (script)', '`s = 42`', '**LogicError** — the first write locked the entry to String, and 42 is not parseable as a String'],
            ] },
            { t: 'p', md: 'The exact Java error you will memorize after one fight with the blackboard:' },
            { t: 'code', lang: 'text', name: 'CONSOLE', code: `LogicError: Blackboard::set(rpm): once declared, the type of a port shall not
change. Previously declared type [java.lang.Integer], current type [java.lang.Double]` },
            { t: 'tip', md: 'It is annoying **on purpose**. A port that flips between counting and metering is usually a bug: two nodes disagreeing about units. The type-lock turns it into a loud tick-time failure instead of a silently-wrong robot.' },
            { t: 'warn', md: 'In the simulator, `Blackboard` behaves exactly like Java here — including the Allows-int-of-2.0 cast. That same strictness catches XML type mistakes: `value="{rpm}"` into an int-typed output explodes the FIRST tick, which is prototype-friendly.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Feel the type-lock (and fix it)',
          workspace: {
            brief: 'This one is designed to fail first. `SetBlackboard value="0"` infers an **int** entry from the literal (Java `inferLiteralValue` → Integer). Then the scoring action insists on writing 2.5 — Java-parity blackboard refuses. Fix the SEED line so the entry is a double from the very first write.',
            tasks: [
              'Run & check → you get a type-lock LogicError',
              'Replace the SetBlackboard seed with a <Script code="shots := 0"/> (script numbers are Java Doubles!)',
              'Run & check again until the checks pass',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <SetBlackboard value="0" output_key="shots"/>
      <ScoreShots shots="{shots}"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <Script code="shots := 0"/>
      <ScoreShots shots="{shots}"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              ScoreShots: {
                type: 'action',
                ports: [{ dir: 'output', name: 'shots', type: 'double' }],
                tick: (ctx) => { ctx.setOutput('shots', 2.5); return 'SUCCESS'; },
              },
            },
            validators: [
              { label: 'shots ends at 2.5', check: (api) => api.get('shots') === 2.5 || `shots = ${api.get('shots')}` },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'The error names it: previously declared type [int], current type [double].',
              'SetBlackboard + literal "0" → Integer. The first write wins the lock.',
              '<Script code="shots := 0"/> is a script → all script numbers are Doubles → the entry announces as double; 2.5 fits.',
            ],
          },
        },
        {
          kind: 'java',
          title: 'Code study: the Java side of set()',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'Blackboard::set (excerpt)', code: `synchronized(entry.lock)
{
  if(!entry.info.isStronglyTyped())
  {
    entry.info = new TypeInfo(value == null ? TypeInfo.ANY_TYPE : value.getClass());
    entry.value = value; entry.sequenceId++; return;
  }

  Class<?> previousType = entry.info.type();
  Class<?> newType = value == null ? previousType : value.getClass();

  if(!previousType.isAssignableFrom(newType) && !newType.isAssignableFrom(previousType))
  {
    boolean mismatching = true;
    if(value instanceof String s) { ...try parsing as previousType... }
    else if(value instanceof Number n && NumericCast.isNumeric(previousType)
            && NumericCast.isSafe(previousType, n)) { mismatching = false; }
    if(mismatching)
      throw new LogicError("Blackboard::set(" + key + "): once declared, the type of a port "
                           + "shall not change. Previously declared type [...], current type [...]");
  }
  entry.value = value;
}` },
            { t: 'note', md: '`NumericCast.isSafe` is what makes `x = 2.0` into an int entry legal but `x = 2.5` illegal: the value must survive the cast *loslessly*. Reading direction is even more forgiving (an int entry read as double widens freely — this is the "safe numeric casting" you will see in Error text).' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: '`speed := 5` was already executed by a Script. Another node does `speed = 2.5`. Result?',
              options: [
                'Allowed — double wins',
                'LogicError: the int entry refuses 2.5 (not losslessly castable)',
                'speed rounds to 3',
              ],
              correct: 1,
              explain: 'isSafe(int, 2.5) is false: writing 2.5 loses the fractional part. Java throws; the sim mirrors it, so scripts must start with 2.5-styled values when they intend doubles.',
              hint: 'isSafe asks: can this double roundtrip back through the declared type with zero data loss?',
            },
          ],
        },
      ],
    },
  ],
};
