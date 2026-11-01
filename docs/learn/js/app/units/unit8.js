// UNIT 8 — The Scripting Language & Conditional Attributes. Operators + precedence (Java-parity:
// all numbers are doubles, booleans are 1.0/0.0), enums, _, conditional attributes.
const msOf = (ctx, name, def) => { const r = ctx.tryGetInput(name, 'int'); return r.present ? r.value : def; };
export default {
  id: 8,
  color: '#e8a13c',
  title: 'The Scripting Language',
  tagline: 'Tiny expressions inside XML: := vs =, chained comparisons and conditional attributes.',
  lessons: [
    {
      id: 'operators',
      title: 'The full operator tour',
      items: [
        {
          kind: 'reading',
          title: 'One grammar, double arithmetic',
          blocks: [
            { t: 'p', md: 'The scripting language (from `<Script code=…>`, `ScriptCondition`, `Precondition if=` and the conditional attributes) is an expression language. **Java parity you must internalize:** scripts hold **no integers and no booleans** — every number is a `double`, and logic/comparison results are the doubles `1.0` / `0.0` (`ExprLiteral((double)val)` upstream).' },
            { t: 'table', cols: ['Category', 'Operators', 'Notes'], rows: [
              ['create / assign', '`:=`  `=`  `+=` `-=` `*=` `/=`', '`:=` creates OR overwrites; plain `=` throws if the entry never existed ("use the operator [:=] instead")'],
              ['ternary', '`? :`', 'condition truthy by 0/1'],
              ['or / and', '`||`  `&&`', 'both operands evaluated, result 1.0/0.0'],
              ['compare + chain', '`==` `!=` `<` `<=` `>` `>=`', 'Python-style chains: `1 < a < 10`; epsilon equality'],
              ['bitwise', '`|` `^` `&`', 'on the 64-bit mass of the double'],
              ['add/concat', '`+` `-` `..`', '`+` is numbers-only; `..` stringifies both sides ("3.5" .. " m" → "3.5 m")'],
              ['unary', '`-` `!` `~`', 'negate / 1.0−x / bitwise complement'],
            ] },
            { t: 'code', lang: 'script', name: 'SCRIPT', code: `shots := 0                    // creates shots as double 0
shots += 2                    // 2.0
speed := 2.5 * 8              // 20.0  (precedence: * before +/..)
line := 'shots: ' .. shots    // "shots: 2"
hot := speed > 18 && 1 < 2 < 3  // comparisons chain, both are 1.0 → 1.0
best := shots > 1 ? 'warm' : 'cold'` },
            { t: 'warn', md: 'NO `%` operator (upstream has none), no template strings, no arrays. Statements are separated by `;` and the LAST value is the script\'s result (what `<ScriptCondition>` actually checks).' },
            { t: 'tip', md: 'Writing `x = 5` on a fresh entry throws on purpose. If you see `Blackboard entry [x] is not initialized… use the operator [:=]`, you wanted `:=`.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Compute the aim profile entirely in scripts',
          workspace: {
            brief: 'No robot actions here — pure math. Chain the blackboard until `profile` reads exactly "**D: 1.5 rpm: 120**" and `go` is 1. Use the `..` operator: `profile := \'D: \' .. D .. \' rpm: \' .. rpm`.',
            tasks: [
              'Script 1: `D := 3`; then divide D by 2 into D itself (`D = D / 2` overwrites — D exists)',
              'Script 2: `rpm := D * 80`',
              'Script 3: `profile := …` and `go := rpm > 100` (boolean → 1.0)',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Math">
  <BehaviorTree ID="Math">
    <Sequence>
      <Script code="D := 3"/>
      <!-- replace me with: D = D / 2 then rpm := D * 80 -->
      <Script code="profile := 'todo'"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Math">
  <BehaviorTree ID="Math">
    <Sequence>
      <Script code="D := 3"/>
      <Script code="D = D / 2"/>
      <Script code="rpm := D * 80"/>
      <Script code="profile := 'D: ' .. D .. ' rpm: ' .. rpm"/>
      <Script code="go := rpm > 100"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {},
            validators: [
              { label: 'D became 1.5', check: (api) => api.get('D') === 1.5 || `D = ${api.get('D')}` },
              { label: 'rpm = 120', check: (api) => api.get('rpm') === 120 || `rpm = ${api.get('rpm')}` },
              { label: 'profile built with .. concatenation', check: (api) => String(api.get('profile')).includes('rpm: 120') || `profile = "${api.get('profile')}"` },
              { label: 'go is 1 (rpm > 100)', check: (api) => api.get('go') === 1 || `go = ${api.get('go')}` },
            ],
            hints: [
              '`D = D / 2` is legal: D exists by then (created with := on the previous line).',
              'A chained comparison like 1 < 2 < 3 evaluates the MIDDLE operand once and re-uses its value.',
              '`..` stringifies any number — 1.5 prints "1.5" like Java System.out.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What does the script `2 < 1 < 3` evaluate to?',
              options: ['1.0 — 1<3 is also true', '0.0 — the first link (2<1) fails and chaining short-circuits', 'a LogicError'],
              correct: 1,
              explain: 'Chained comparisons are Python-style: the chain is (2<1)=false → short-circuits to 0.0 without even evaluating the last link… exactly like the Java ExprComparison loop that returns 0.0 at the first failing link.',
              hint: 'Once one link fails, no further operand is evaluated.',
            },
            {
              q: '`distance := 3` then `distance = distance / 2`. Legal?',
              options: [
                'Yes — := created it, so `=` overwrites freely',
                'No — `=` always refuses math on doubles',
                'Only if written as distance := distance / 2',
              ],
              correct: 0,
              explain: '= just requires existence. Script numbers are doubles under the hood, so 3/2 → 1.5 fits without a type-lock fight (the entry was double-typed from the very first write).',
              hint: 'The := created it — what matters for = is just existence.',
            },
          ],
        },
      ],
    },
    {
      id: 'enums',
      title: 'Scripting enums',
      items: [
        {
          kind: 'java',
          title: 'Code study: registering enums',
          blocks: [
            { t: 'code', lang: 'java', name: 'JAVA', file: 'RobotContainer.java', code: `// one value at a time:
factory.registerScriptingEnum("CLOSE_STATION", 0);
factory.registerScriptingEnum("LOADING", 1);

// or a whole Java enum by ordinal (GameState.START, GameState.PARK, ...):
factory.registerScriptingEnums(GameState.class);

// then scripts compare with the bare names:
//   <ScriptCondition code="state == START"/>` },
            { t: 'p', md: 'Enums become named integers inside the scripting namespace. In scripts, a bare `NAME` that is not on the blackboard falls back to the enum registry (`ScriptSupport` lookup) — so `state := START` declares `state` as an **int** entry (Java: enum values are Integers — the one exception to "script numbers are doubles").' },
            { t: 'p', md: 'The simulator accepts `enums: { NAME: value }` per exercise — same mapping, no Java compilation needed:' },
            { t: 'code', lang: 'script', name: 'SCRIPT', code: `state := LOADING          // 1, declared int
at := state == LOADING    // 1.0 (the comparison itself is still a double result)` },
            { t: 'note', md: 'Because enum lookups happen at EVALUATION time, renaming an enum constant is a build-safe refactor but a runtime error for deployed XML: the missing name throws "Variable not found: RENAMED_NAME" the first tick, not at load.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Drive the state machine',
          workspace: {
            brief: 'Enums are pre-registered: `IDLE=0`, `COLLECT=1`, `SHOOT=2`. Seed `state := COLLECT`, then a `MoveHead` node that looks at `state` (composer head moves only in COLLECT) — and finally flip `state` to SHOOT so a `Launcher` node fires.',
            tasks: [
              'Script: `state := COLLECT` then <MoveHead/>, then `state := SHOOT` then <Launcher/>',
              'Both deliveries must complete; MoveHead must report DONE=1 (its onHalted sets nothing)',
              'The `state` blackboard entry must end as int 2',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="SM">
  <BehaviorTree ID="SM">
    <Sequence>
      <Script code="state := COLLECT"/>

      <Script code="state := SHOOT"/>

    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="SM">
  <BehaviorTree ID="SM">
    <Sequence>
      <Script code="state := COLLECT"/>
      <MoveHead/>
      <Script code="state := SHOOT"/>
      <Launcher/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              MoveHead: {
                type: 'stateful',
                onStart: (ctx) => (ctx.blackboard.get('state','int') === 1 ? (ctx.blackboard.set('headMoved', 1), 'RUNNING') : 'FAILURE'),
                onRunning: (ctx) => { ctx.blackboard.set('headDone', 1); return 'SUCCESS'; },
              },
              Launcher: {
                type: 'stateful',
                onStart: (ctx) => {
                  if (ctx.blackboard.get('state','int') !== 2) return 'FAILURE';
                  ctx.blackboard.set('launchTicks', 0);
                  ctx.log('[Launcher] starts (state == SHOOT)');
                  return 'RUNNING';
                },
                onRunning: (ctx) => {
                  const t = ctx.blackboard.get('launchTicks','int');
                  ctx.blackboard.set('launchTicks', t + 1);
                  return t + 1 >= 4 ? 'SUCCESS' : 'RUNNING';
                },
              },
            },
            enums: { IDLE: 0, COLLECT: 1, SHOOT: 2 },
            validators: [
              { label: 'MoveHead ran in COLLECT state', check: (api) => api.get('headMoved') === 1 || 'head never moved' },
              { label: 'state ended at SHOOT (int 2)', check: (api) => api.get('state') === 2 || `state = ${api.get('state')}` },
              { label: 'Launcher actually ran (state==SHOOT)', check: (api) => api.ticksOf('Launcher') >= 1 || 'Launcher never started' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              '`state := COLLECT` — the bare name resolves to 1 through the exercise enum registry.',
              'The enum-lookup path declares the entry as int (Java: registry values are Integers) — write exact ints afterwards: `state := SHOOT`.',
              'Fixture: Launch only fires when state == 2; ordering the scripts around the nodes is the whole exercise.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Which is TRUE about enum values reaching the blackboard?',
              options: [
                'They arrive as doubles because all script numbers are doubles',
                'They arrive as ints — the Java registry stores Integer, and `state := SHOOT` declares an int entry',
                'They arrive as strings',
              ],
              correct: 1,
              explain: 'One deliberate exception: enum values come from Map<String,Integer> and type the entry as int. Ordinary script literals are Doubles. That distinction matters when the type-lock fires later.',
              hint: 'Look at how the registry is typed in Java.',
            },
          ],
        },
      ],
    },
    {
      id: 'cond-attrs',
      title: 'Conditional attributes',
      items: [
        {
          kind: 'reading',
          title: 'Pre- and post-conditions on ANY node',
          blocks: [
            { t: 'table', cols: ['Attribute', 'When', 'Effect'], rows: [
              ['`_skipIf="code"`', 'pre, node IDLE/SKIPPED', 'code is truthy → node SKIPPED (unticked)'],
              ['`_successIf="code"`', 'pre, node IDLE', 'code is truthy → the node instantly SUCCESS without ticking it'],
              ['`_failureIf="code"`', 'pre, node IDLE', 'code is truthy → FAILURE without ticking'],
              ['`_while="code"`', 'pre, IDLE/RUNNING', 'truthy → run the node this tick. **While RUNNING: false → halt the node and return SKIPPED** — the ONLY conditional that interrupts RUNNING'],
              ['`_onSuccess="_post code"`', 'post, after SUCCESS', 'runs the code once'],
              ['`_onFailure=…`', 'post, after FAILURE', 'runs the code once'],
              ['`_post=…`', 'post, any terminal status', 'runs the code once'],
            ] },
            { t: 'code', lang: 'xml', name: 'XML', file: 'cond-attrs.xml', code: `<Intake ms="400" _while="gamePieceMissing" _onSuccess="true"/>

<SpinUp BaseActivity rpm="3200" _skipIf="debugMode"/>` },
            { t: 'p', md: 'The evaluation order is fixed (`TreeNode.java`): `_failureIf` → `_successIf` → `_skipIf` → `_while`, each consulted only when the node state allows (IDLE for the skip/force/while-first cases; RUNNING for the interrupting `_while`). Post-conditions run only on a terminal status and once per completing tick.' },
            { t: 'tip', md: 'Conditional attributes are all SCRIPTS — so small snippets land on the node element itself. Prefer these for noisy wiring (`_skipIf` for a debug mode, `_onSuccess` to record a label) over wrapped decorations with an entirely new path.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'tracking-success.xml', code: '<Script code="autonScore := 0"/>\n<Shoot _onSuccess="autonScore := autonScore + 1"/>' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Gate the mechanism with conditionals',
          workspace: {
            brief: 'The so-called practice robot: script flags `broken := false` … except it is about 1.10/0.0 in scripts. Build: `<Shoot _skipIf="broken">` — the run must tick Shoot ZERO times but still finish with a clean status. Then the post-attr: bonus score on success of Intake.',
            tasks: [
              'Seed `broken := 1` BEFORE Shoot',
              'Add `_skipIf="broken"` on the the Shoot node',
              'Add `_onSuccess="autonScore := autonScore + 1"` on Intake AND confirm the counter is 1 after success',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Cond">
  <BehaviorTree ID="Cond">
    <Sequence>
      <Script code="broken := 1"/>
      <Intake ms="300"/>
      <Shoot/>
    </Sequence>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Cond">
  <BehaviorTree ID="Cond">
    <Sequence>
      <Script code="broken := 1"/>
      <Script code="autonScore := 0"/>
      <Intake ms="300" _onSuccess="autonScore = autonScore + 1"/>
      <Shoot _skipIf="broken"/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {
              Intake: {
                type: 'stateful',
                ports: [{ dir: 'input', name: 'ms', type: 'int' }],
                onStart: (ctx) => { ctx.blackboard.set('intakeT', 0); ctx.log('[Intake] ' + (ctx.tryGetInput('ms','int').present ? 'runs' : 'no ms')); return 'RUNNING'; },
                onRunning: (ctx) => {
                  const t = ctx.blackboard.get('intakeT','int');
                  ctx.blackboard.set('intakeT', t + 1);
                  ctx.log('[Intake] spinning ' + t);
                  return t + 1 >= 5 ? 'SUCCESS' : 'RUNNING';
                },
              },
              Shoot: { type: 'stateful', onStart: () => 'SUCCESS' },
            },
            validators: [
              { label: 'Shoot never ticked', check: (api) => api.ticksOf('Shoot') === 0 || `Shoot ticked ${api.ticksOf('Shoot')} times` },
              { label: 'autonScore counted ONE success', check: (api) => api.get('autonScore') === 1 || `autonScore = ${api.get('autonScore')}` },
              { label: 'tree ended SUCCESS (skipped child does not poison)', check: (api) => (api.status === 'SUCCESS') || `tree ended ${api.status}` },
            ],
            hints: [
              'The sequence SKIPS over the Shoot (because of _skipIf) and marks SUCCESS — nothing else is affected.',
              'Scripts start with broken := 1 (scripts have no plain booleans; 1.0 is truthy).',
              'A sequence with one skipped and rest SUCCESS returns SUCCESS — SKIPPED does not break the chain.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'Which conditional can HALT an already-RUNNING node?',
              options: ['_skipIf', '_successIf', '_while'],
              correct: 2,
              explain: 'While RUNNING, a _while that turns false halts the node immediately and returns SKIPPED — every other condition applies only on the IDLE→first-tick boundary. Upstream: that is PreCond::WHILE.',
              hint: 'Only one of them takes the RUNNING state seriously.',
            },
            {
              q: 'Where can you put a script?',
              options: [
                'Only a node that declares a code port',
                'Four places: <Script>, <ScriptCondition>, <Precondition if>, and the conditional attributes',
                'Anywhere inside a comment block',
              ],
              correct: 1,
              explain: 'The exact same parser (ScriptParser.parse) backs all four call sites — a guaranteed identical grammar across tools.',
              hint: 'They are same-grammar, different wiring.',
            },
          ],
        },
      ],
    },
  ],
};
