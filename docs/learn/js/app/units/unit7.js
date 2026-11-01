// UNIT 7 — Subtrees, Remapping & Big Trees. <SubTree>, explicit remaps, {=} alias, _autoremap,
// @root escape, <TreeNodesModel> mandatory ports, and organizing big XML documents.
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
  id: 7,
  color: '#7a5ef0',
  title: 'Subtrees, Remapping & Big Trees',
  tagline: 'Compose, share and reconnect trees without spaghetti point-to-point wiring.',
  lessons: [
    {
      id: 'subtree-remaps',
      title: '<SubTree> with explicit remaps',
      items: [
        {
          kind: 'reading',
          title: 'A library of tree pieces',
          blocks: [
            { t: 'p', md: 'Real autos grow past one screen of XML. `BehaviorTreeFactory.registerBehaviorTreeFromText/File` (or several `<BehaviorTree>` sections in one file) builds a **library** of named trees, and `<SubTree ID="Name"/>` embeds one into another.' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'remap.xml', code: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <SubTree ID="ShootRoutine" rpm="{finalRpm}"/>
      <KeepWarm ms="100"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="ShootRoutine">
    <Sequence>
      <SpinTo target_rpm="{finalRpm}"/>
      <Shoot/>
    </Sequence>
  </BehaviorTree>
</root>` },
            { t: 'p', md: 'Look carefully at `rpm="{finalRpm}"` on the SubTree element: the SHOOTROUTINE-internal name (`rpm`... spelling shown normalized as {finalRpm} in this example) is **remapped** to the parent\'s key. Inside the subtree, SpinTo reads `{finalRpm}`; outside the parent writes it first. Every port listed on the SubTree element becomes a **redirection**, not a value:' },
            { t: 'table', cols: ['XML on <SubTree>', 'Meaning'], rows: [
              ['`param="{myParam}"`', 'subtree\'s `param` ↔ parent\'s `myParam` entry'],
              ['`param="{=}"`', 'shorthand: use the SAME NAME in the parent (param ↔ param)'],
              ['`param="3.5"`', 'a literal snapshot bound into the subtree\'s blackboard'],
              ['`_autoremap="1"`', 'remap EVERYTHING by name automatically (no attributes needed)'],
            ] },
            { t: 'note', md: 'A SubTree gets its own **child Blackboard**, chained to the parent\'s (that is how Java `Blackboard.create(parent)` builds the runtime chain). Remaps and `_autoremap` are properties of that child blackboard; the `@key` prefix in any script still escapes straight to the root blackboard.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Split a plan into a subtree',
          workspace: {
            brief: 'The pickup piece (`Intake` then `Clamp`) must move into a `<BehaviorTree ID="PickupRoutine">` and the Main tree must call it remapped: the subtree\'s `intake_ms` comes from the parent\'s entry `speed_setting` (a literal-snapshot is NOT allowed — the driver tunes it between matches).',
            tasks: [
              'Create the PickupRoutine BehaviorTree with <Intake intake_ms="{intakeCfg}"/><Clamp/>',
              'In Main: <SubTree ID="PickupRoutine" intake_ms="{intakeCfg}"/>',
              'Main must also <Arm ms="200"/> before calling the SubTree.',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <!-- arm, then call the subtree -->
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="PickupRoutine">
    <!-- intake with configurable ms, then clamp -->
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <Arm ms="200"/>
      <SubTree ID="PickupRoutine" intake_ms="{intakeCfg}"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="PickupRoutine">
    <Sequence>
      <Intake intake_ms="{intakeCfg}"/>
      <Clamp/>
    </Sequence>
  </BehaviorTree>
</root>`,
            maxTicks: 80,
            nodes: {
              Arm: { type: 'command', ports: [{ dir: 'input', name: 'ms', type: 'int', default: '100' }], supplier: timedCmd(200) },
              Intake: {
                type: 'command',
                ports: [{ dir: 'input', name: 'intake_ms', type: 'int', default: '400' }],
                supplier: timedCmd(400, 'intake_ms'),
              },
              Clamp: { type: 'stateful', onStart: (ctx) => { ctx.blackboard.set('@clamped', 1); return 'SUCCESS'; } },
            },
            beforeTick: (runner) => { scheduler.step(runner); runner.blackboard.set('intakeCfg', 400); },
            validators: [
              { label: 'Arm ran, then Intake, then Clamp', check: (api) => (api.ticksOf('Arm') > 0 && api.lastReturnOf('Intake') === 'SUCCESS' && api.lastReturnOf('Clamp') === 'SUCCESS') || 'the plan order broke' },
              { label: 'Intake used the remapped 400 ms (≥ 8 ticks)', check: (api) => api.ticksOf('Intake') >= 8 || `Intake ran ${api.ticksOf('Intake')} ticks — remapping did not reach it` },
              { label: 'Clamp ran and wrote @clamped on the ROOT blackboard', check: (api) => api.get('@clamped') === 1 || 'the subtree never ran (try the @key root escape)' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'Ports on the SubTree element are redirections: intake_ms points at the same-named parent key.',
              'The subtree\'s own Intake reads its OWN port name (intake_ms) — same name in both places with the default route.',
              'The subtree has its OWN blackboard — a `@key` script prefix (or `ctx.blackboard.set(...)`) is the sim\'s note for "store on the root blackboard so the parent sees it".',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'On <SubTree ID="R" speed="{tickSpeed}"/>, what does the subtree see when it reads {speed}?',
              options: [
                'Its own entry speed, seeded with the parent\'s tickSpeed value',
                'It reads the parent\'s tickSpeed entry directly through a redirection',
                'A frozen copy of the value, taken once at build time',
              ],
              correct: 1,
              explain: 'Remapping is live aliasing, not snapshot: the subtree\'s reads/writes of speed land on the parent\'s tickSpeed entry. A literal (speed="3.5") is what creates a value-bound child entry.',
              hint: 'Remap = alias. Literal = snapshot.',
            },
          ],
        },
      ],
    },
    {
      id: 'autoremap',
      title: '_autoremap and {=}',
      items: [
        {
          kind: 'reading',
          title: 'Same names, zero wiring',
          blocks: [
            { t: 'code', lang: 'xml', name: 'XML', file: 'autoremap.xml', code: `<BehaviorTree ID="Main">
  <SubTree ID="TuneRoutine" name="tune" _autoremap="1"/>
  <!-- the TuneRoutine subtree and the parent agree to share port names -->
</BehaviorTree>` },
            { t: 'list', items: [
              '`_autoremap="1"`: any entry the subtree touches — reading OR writing — transparently goes through to the parent blackboard when the subtree itself does not hold it. Great for "dashboard globals".',
              '`{=}` on an individual port: "use my own name in BOTH places" — precise remapping without duplicating names.',
              'Read vs write: Java\'s Blackboard resolves reads through remaps, and a **write** on an auto-remapped subtree goes to the parent too — the entry is CREATED in the parent when nothing exists there (createEntryImpl parity, mirrored by the sim).',
            ] },
            { t: 'warn', md: 'Keys starting with `_` (like `_autoremap` itself, `_skipIf`, `_while`) are PRIVATE and never auto-remapped — they decorate node configuration, not robot data.' },
            { t: 'p', md: 'And for the rare global: `<Script code="@debug := 1"/>` writes `debug` directly on the ROOT blackboard, no matter how deep you are — handy for cross-cutting diagnostics, dangerous as a habit for real data.' },
          ],
        },
        {
          kind: 'exercise',
          title: 'Autoremap a TuneRoutine',
          workspace: {
            brief: 'A tuning subtree reads `rpm` and returns a `gain` — build the subtree with `<SubTree ID="Tune" _autoremap="1"/>` and NO other attributes. The Tune subtree — write `gain := rpm / 100` inside it (parent first seeds rpm := 250).',
            tasks: [
              'Define <BehaviorTree ID="Tune"> containing a <Script code="gain := rpm / 100"/> that reads parent\'s rpm with NO explicit remaps',
              'Main: <Script code="rpm := 250"/> then <SubTree ID="Tune" _autoremap="1"/>',
              'gain must land on the parent blackboard as 2.5',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <!-- seed rpm, call the subtree with _autoremap -->
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="Tune">
    <!-- read rpm; write gain -->
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <Sequence>
      <Script code="rpm := 250"/>
      <SubTree ID="Tune" _autoremap="1"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="Tune">
    <Script code="gain := rpm / 100"/>
  </BehaviorTree>
</root>`,
            maxTicks: 40,
            nodes: {},
            validators: [
              { label: 'gain computed as 2.5', check: (api) => api.get('gain') === 2.5 || `gain = ${api.get('gain')}` },
              { label: 'rpm exists on the parent', check: (api) => api.get('rpm') === 250 || 'parent never seeded rpm' },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'The subtree script reads `rpm` transparently — _autoremap makes the parent entry visible by the same name.',
              'gain is written INSIDE the subtree but must be visible on the parent: writes with autoRemapping create/land in the parent\'s blackboard (createEntryImpl parity).',
              'Script division: rpm / 100 with rpm = 250 (script numbers are doubles) → 2.5.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'What is the PRIVATE-key rule on subtrees?',
              options: [
                'Private keys starting with `_`, like _skipIf, are never auto-remapped to the parent',
                'Private keys are copied to every blackboard',
                'There is no private namespace',
              ],
              correct: 0,
              explain: 'Upstream isPrivateKey(key) guards remapping: configuration attributes belong to the node, not the data plane. Data keys never collide with debugging conditionals.',
              hint: 'Same prefix used by _onSuccess/_while/-conditionals.',
            },
          ],
        },
      ],
    },
    {
      id: 'model',
      title: 'TreeNodesModel & big documents',
      items: [
        {
          kind: 'reading',
          title: 'Describe your library, get early errors',
          blocks: [
            { t: 'p', md: 'A `<TreeNodesModel>` (root-level, next to the `<BehaviorTree>`s) is the machine-readable "port table" of your subtree library. The factory uses it for two things: tooling metadata, and **mandatory-port enforcement when instantiating SubTree nodes**:' },
            { t: 'code', lang: 'xml', name: 'XML', file: 'treenodesmodel.xml', code: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <TreeNodesModel>
    <SubTree ID="PickupRoutine">
      <input_port name="intake_ms" default="400"/>
      <output_port name="clamped_ok"/>
    </SubTree>
  </TreeNodesModel>

  <BehaviorTree ID="Main">
    <SubTree ID="PickupRoutine"/>   <!-- no intake_ms! build fails NOW -->
  </BehaviorTree>

  <BehaviorTree ID="PickupRoutine">
    <Sequence>
      <Intake intake_ms="{intake_ms}"/>
      <Clamp/>
    </Sequence>
  </BehaviorTree>
</root>` },
            { t: 'list', items: [
              'A `SubTree` entry that declares an `input_port` WITHOUT a `default` becomes **mandatory**: omitting it on the call site fails at BUILD time — the same protection ToolBox gives you in BT.CPP.',
              'With a `default`, the call-site omission is legal; the engine creates the child entry with the default.',
              'Node ports (leaf actions) have their equivalents inside a TreeNodesModel too — `<Action ID="Intake"><input_port name="ms" default="300"/></Action>` — the factory uses these for the same early-wiring checks on leaf invocations.',
            ] },
            { t: 'p', md: 'Organizing bigger documents:' },
            { t: 'list', items: [
              'One file per major routine + subtrees in the same file (there is no `<include>` in this port — deliberately absent as a fingerprint that upstream removed the external-deps surface thinking compound; the sim\'s <include> does NOT exist — put all trees in one document).',
              'keep main_tree_to_execute LAST or FIRST — teammates should never guess the entry point.',
              'Name nodes that matter (`name="EmergencyStop"`) — the full path shows in logs and in the NTBehaviorTreeLogger (unit 9).',
            ] },
            { t: 'code', lang: 'java', name: 'JAVA', file: 'Java side', code: `factory.registerBehaviorTreeFromFile(Path.of("deploy", "autonomous.xml"));
factory.registerBehaviorTreeFromFile(Path.of("deploy", "parking.xml"));

Tree autoA       = factory.createTree("ParaMainMain");      // entry id
Tree parkingBack = factory.createTree("ParkOnlyMain");       // same factory, different root
// (entries must have been registered first: same corpus semantics as BT.CPP)` },
          ],
        },
        {
          kind: 'exercise',
          title: 'Enforce a mandatory port',
          workspace: {
            brief: 'Add a `<TreeNodesModel>` to this doc that declares `coil_ms` as a MANDATORY (no-default) input of ShootingRoutine, then fix the call site so the supplier `coil_ms` gets satisfied with `{parentCoilMs}`.',
            tasks: [
              'Add <TreeNodesModel> that ONLY declares <SubTree ID="ShootingRoutine"><input_port name="coil_ms"/></SubTree>',
              'On the call site: <SubTree ID="ShootingRoutine" coil_ms="{parentCoilMs}"/>',
              'Tree SUCCESS; the routine received 500 ms (10+ ticks)',
            ],
            startXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <BehaviorTree ID="Main">
    <SubTree ID="ShootingRoutine"/>
  </BehaviorTree>

  <BehaviorTree ID="ShootingRoutine">
    <Coil coil_ms="{coil_ms}"/>
  </BehaviorTree>
</root>`,
            refXml: `<root BTCPP_format="4" main_tree_to_execute="Main">
  <TreeNodesModel>
    <SubTree ID="ShootingRoutine">
      <input_port name="coil_ms"/>
    </SubTree>
  </TreeNodesModel>

  <BehaviorTree ID="Main">
    <Sequence>
      <Script code="parentCoilMs := 500"/>
      <SubTree ID="ShootingRoutine" coil_ms="{parentCoilMs}"/>
    </Sequence>
  </BehaviorTree>

  <BehaviorTree ID="ShootingRoutine">
    <Coil coil_ms="{coil_ms}"/>
  </BehaviorTree>
</root>`,
            maxTicks: 60,
            nodes: {
              Coil: { type: 'command', ports: [{ dir: 'input', name: 'coil_ms', type: 'int', default: '500' }], supplier: timedCmd(500, 'coil_ms') },
            },
            beforeTick: (runner) => scheduler.step(runner),
            validators: [
              { label: 'Coil ran over 10 ticks (500 ms from parent)', check: (api) => api.ticksOf('Coil') >= 11 || `Coil ran ${api.ticksOf('Coil')} ticks` },
              { label: 'tree ended SUCCESS', check: (api) => api.status === 'SUCCESS' || `tree ended ${api.status}` },
            ],
            hints: [
              'input_port with no default attribute = mandatory. The engine says: "SubTree \"ShootingRoutine\" requires a mandatory input port [coil_ms]"',
              'parentCoilMs is seeded by a script in Main before the SubTree call.',
              'Inside the subtree, the Coil keeps reading ITS port name (coil_ms) — that is the remapping traffic.',
            ],
          },
        },
        {
          kind: 'quiz',
          title: 'Check yourself',
          questions: [
            {
              q: 'SubTree model declares input `coil_ms` WITH default="300". Call sites leave it out. What happens at build & runtime?',
              options: [
                'Build fails — all model inputs are mandatory',
                'Build OK; the child entry coil_ms is created with 300',
                'Build OK; coil_ms is missing and Coil ticks fail',
              ],
              correct: 1,
              explain: 'The default prevents mandatory-ness; on instantiation the child entry is created with the given default — that is exactly Port.input(Int.class, "coil_ms", 300) semantics carried into the tree XML model.',
              hint: 'Mandatory = no default.',
            },
          ],
        },
      ],
    },
  ],
};
