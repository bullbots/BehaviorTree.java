// Engine fidelity suite — mirrors key behaviors of java/behaviortree-core.
// Runs in node (see dev scripts) and in the browser via /test.html.
import { Runner } from './runner.js';
import { parseScript } from './script.js';
import { Blackboard } from './blackboard.js';
import { simClock } from './clock.js';
import { createTreeFromText } from './factory.js';

const LOG = [];
function out(s) { LOG.push(s); }
function ok(name, fn) {
  try { fn(); passed++; out('  ✓ ' + name); }
  catch (e) { failed++; out('  ✗ ' + name + '\n      ' + (e._msg || e.message) + (e.stack ? '\n' + e.stack.split('\n')[1] : '')); }
}
function eq(a, b) { if (s(a) !== s(b)) throw new Error(`expected ${s(b)}, got ${s(a)}`); }
function s(x) { return typeof x === 'object' ? JSON.stringify(x) : String(x); }

out('== script language ==');
ok('precedence 1+2*3', () => {
  const bb = Blackboard.create();
  eq(parseScript('1+2*3').evaluate(bb, {}), 7);
});
ok('assignment := and = error', () => {
  const bb = Blackboard.create();
  parseScript('A:=1').evaluate(bb, {});
  eq(bb.get('A', 'int'), 1);
  let threw = false;
  try { parseScript('B = 2').evaluate(bb, {}); } catch { threw = true; }
  if (!threw) throw new Error('= on missing var must throw');
});
ok('chained comparison 1<2<3', () => {
  const bb = Blackboard.create();
  eq(parseScript('1<2<3').evaluate(bb, {}), 1);   // Java: comparisons yield 1.0 / 0.0 doubles
  eq(parseScript('2<1<3').evaluate(bb, {}), 0);
});
ok('booleans are 0.0/1.0 doubles (Java parity)', () => {
  const bb = Blackboard.create();
  eq(parseScript('true').evaluate(bb, {}), 1);
  eq(parseScript('!5 > 10').evaluate(bb, {}), 0);
  eq(parseScript('false || true').evaluate(bb, {}), 1);
  eq(parseScript('3 > 1 && 2 > 1').evaluate(bb, {}), 1);
});
ok('string concat .. and quoted?', () => {
  const bb = Blackboard.create();
  eq(parseScript(`msg := 'hello' .. ' ' .. 'world'`).evaluate(bb, {}), 'hello world');
});
ok('ternary', () => {
  const bb = Blackboard.create();
  eq(parseScript(`x := 1; y := x > 0 ? 42 : 0`).evaluate(bb, {}), 42);
});
ok('enums resolve bare names', () => {
  const bb = Blackboard.create();
  eq(parseScript('color := RED').evaluate(bb, { RED: 3 }), 3);
});
ok('compound +=', () => {
  const bb = Blackboard.create();
  parseScript('x:=5').evaluate(bb, {});
  eq(parseScript('x += 5').evaluate(bb, {}), 10);
});

out('== control nodes ==');
ok('Sequence restarts from 0 after FAILURE', () => {
  let calls = { a: 0, b: 0 };
  const H = { fail: true };
  const nodes = {
    A: { type: 'action', tick: () => { calls.a++; return H.fail ? 'FAILURE' : 'SUCCESS'; } },
    B: { type: 'action', tick: () => (calls.b++, 'SUCCESS') },
  };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><A/><B/></Sequence></BehaviorTree></root>`, nodes });
  r.tick();          // A fails → Sequence FAILURE, restarts at index 0
  H.fail = false;
  r.tick();          // A succeeds, then B — no child skipped
  eq(calls.a, 2); eq(calls.b, 1);
});
ok('Fallback succeeds on later child', () => {
  const nodes = {
    F: { type: 'condition', tick: () => 'FAILURE' },
    S: { type: 'action', tick: () => 'SUCCESS' },
  };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Fallback><F/><S/></Fallback></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
});
ok('ReactiveSequence re-ticks condition', () => {
  let cond = 0;
  const nodes = {
    C: { type: 'condition', tick: () => { cond++; return 'SUCCESS'; } },
    D: { type: 'stateful', onStart: () => 'RUNNING', onRunning: () => 'RUNNING' },
  };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><ReactiveSequence><C/><D/></ReactiveSequence></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished(5);
  // D runs forever; condition should be re-ticked on later ticks
  eq(cond > 1, true);
});
ok('Switch matches case_2', () => {
  const nodes = { C1: { type: 'action', tick: () => 'SUCCESS' }, C2: { type: 'action', tick: () => 'SUCCESS' }, DEF: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Switch2 variable="{var}" case_1="a" case_2="42"><C1 name="A"/><C2 name="B"/><DEF name="D"/></Switch2></BehaviorTree></root>`, nodes });
  r.blackboard.set('var', 42);
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
  eq(r.tally().find((x) => x.name === 'B').count, 1);
  eq(r.tally().find((x) => x.name === 'A').count, 0);
  eq(r.tally().find((x) => x.name === 'D').count, 0);
});
ok('IfThenElse picks else', () => {
  const nodes = { T: { type: 'action', tick: () => 'SUCCESS' }, F: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><IfThenElse><AlwaysFailure/><T/><F/></IfThenElse></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  eq(r.tally().find((x) => x.name === 'T').count, 0);
  eq(r.tally().find((x) => x.name === 'F').count, 1);
});
ok('Parallel 2 of 3', () => {
  const nodes = { R1: { type: 'action', tick: () => 'SUCCESS' }, R2: { type: 'action', tick: () => 'RUNNING' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Parallel success_count="2"><AlwaysSuccess/><AlwaysSuccess/><R2/></Parallel></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished(4);
  eq(res.status, 'SUCCESS');
});

out('== decorators ==');
ok('Timeout fails late child (poll-based)', () => {
  const nodes = { Slow: { type: 'stateful', onStart: () => 'RUNNING', onRunning: () => 'RUNNING' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Timeout msec="300"><Slow/></Timeout></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished(10);
  eq(res.status, 'FAILURE');
  eq(res.tickIndex, 6); // deadline 300ms anchored at tick start; 50ms/tick → fails on tick 6
});
ok('Delay postpones child', () => {
  const nodes = { D: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Delay delay_msec="200"><D/></Delay></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  const t = r.tally().find((x) => x.name === 'D');
  eq(t.count, 1);
  eq(r.tickIndex, 4); // 200ms fully elapsed at tick 4 (50ms/tick, anchored at tick start)
});
ok('Retry only runs on failure', () => {
  let k = 0;
  const nodes = { F: { type: 'action', tick: () => { k++; return 'FAILURE'; } } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Retry num_attempts="3"><F name="F2"/></Retry></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'FAILURE');
  eq(k, 3);
});
ok('Repeat works', () => {
  let k = 0;
  const nodes = { S: { type: 'action', tick: () => { k++; return 'SUCCESS'; } } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Repeat num_cycles="4"><S name="S2"/></Repeat></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
  eq(k, 4);
  eq(r.tally().find((x) => x.name === 'S2').count, 4);
});
ok('RunOnce then_skip', () => {
  const nodes = { S: { type: 'action', tick: () => 'SUCCESS' }, B: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><RunOnce><S name="S2"/></RunOnce><B/></Sequence></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  eq(r.tally().find((x) => x.name === 'S2').count, 1);
});

out('== blackboard ==');
ok('type lock throws', () => {
  const bb = Blackboard.create();
  bb.set('x', 1);
  let threw = false;
  try { bb.set('x', 'hello'); } catch { threw = true; }
  if (!threw) throw new Error('type lock broken');
});
ok('int entry rejects 1.5 — NumericCast.isSafe parity', () => {
  const bb = Blackboard.create();
  bb.set('x', 1);
  let threw = false;
  try { bb.set('x', 1.5); } catch { threw = true; }
  if (!threw) throw new Error('1.5 into an int entry must throw (Java LogicError)');
});
ok('int entry accepts integral double / double accepts int', () => {
  const bb = Blackboard.create();
  bb.set('x', 1);
  bb.set('x', 2.0);                    // isSafe(int, 2.0) → true
  eq(bb.get('x', 'double'), 2.0);
  bb.set('d', 2.5);
  bb.set('d', 1);                      // isSafe(double, 1) → true
  eq(bb.get('d', 'int'), 1);
});
ok('script numbers are Doubles (Java script parity)', () => {
  const bb = Blackboard.create();
  parseScript('n := 1').evaluate(bb, {});
  const e = bb.getEntry('n');
  eq(e.type, 'double');   // ExprLiteral casts integers to double — even `1`
  eq(bb.get('n', 'int'), 1);
});
ok('script writes blackboard', () => {
  const nodes = { S: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><Script code="dist := 2.5"/><SetBlackboard value="2.5" output_key="dd"/></Sequence></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  eq(r.blackboard.get('dist', 'double'), 2.5);
  eq(r.blackboard.get('dd', 'double'), 2.5);
});
ok('ports: in literal, out pointer', () => {
  let seen = null;
  const nodes = {
    P: {
      type: 'action',
      ports: [{ dir: 'input', name: 'dist', type: 'double' }, { dir: 'output', name: 'out' }],
      tick: (ctx) => {
        seen = ctx.getInput('dist', 'double');
        ctx.setOutput('out', 7.5);
        return 'SUCCESS';
      },
    },
  };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><P dist="1.5" out="{outKey}"/></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  eq(seen, 1.5);
  eq(r.blackboard.get('outKey', 'double'), 7.5);
});

out('== conditions & attributes ==');
ok('_skipIf prevents ticking', () => {
  const nodes = { M: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><M name="M2" _skipIf="true"/></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'SKIPPED');
  eq(r.tally().find((x) => x.name === 'M2')?.count ?? 0, 0);
});
ok('_successIf forces SUCCESS', () => {
  let calls = 0;
  const nodes = { M: { type: 'action', tick: () => { calls++; return 'SUCCESS'; } } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><Script code="ok := 1"/><M name="M2" _successIf="ok"/></Sequence></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
  eq(calls, 0);
});
ok('ScriptCondition halts Sequence', () => {
  const nodes = { A: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><ScriptCondition code="2 &gt; 1"/><Script code="done := 4"/><ScriptCondition code="1 &gt; 2"/></Sequence></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(r.blackboard.get('done', 'int'), 4);    // Script ran before the failing condition
  eq(res.status, 'FAILURE');                 // second ScriptCondition failed → Sequence failed
});
ok('Precondition node via script', () => {
  const nodes = { A: { type: 'action', tick: () => 'SUCCESS' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><Sequence><Script code="go := 1"/><Precondition if="go"><A name="A2"/></Precondition></Sequence></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
  eq(r.blackboard.get('go', 'int'), 1);
  eq(r.tally().find((x) => x.name === 'A2').count, 1);
});
ok('_while interrupts RUNNING', () => {
  let running = 0, halted = 0;
  const nodes = {
    M: {
      type: 'stateful',
      onStart: (ctx) => 'RUNNING',
      onRunning: (ctx) => { running++; return 'RUNNING'; },
      onHalted: (ctx) => { halted++; },
    },
  };
  const r = new Runner({
    xml: `<root><BehaviorTree ID="T"><Sequence><Script code="keep := 1"/><M name="M2" _while="keep"/></Sequence></BehaviorTree></root>`,
    nodes,
    beforeTick: (runner) => { if (running >= 2) runner.blackboard.set('keep', 0); },
  });
  const res = r.runUntilFinished(10);
  eq(halted, 1);              // keep flipped to 0 while M was RUNNING → onHalted fired
  eq(res.status, 'SUCCESS');  // M SKIPPED → the Sequence moves on and reports SUCCESS
});

out('== subtrees ==');
ok('subtree remapping explicit', () => {
  const nodes = {
    P: {
      type: 'action',
      ports: [{ dir: 'input', name: 'param', type: 'double' }, { dir: 'output', name: 'heard', type: 'string' }],
      tick: (ctx) => { ctx.setOutput('heard', 'got' + JSON.stringify(ctx.getInput('param', 'double'))); return 'SUCCESS'; },
    },
  };
  const xml = `<root main_tree_to_execute="Main"><BehaviorTree ID="Talk"><P name="T" param="{=}" heard="{=}"/></BehaviorTree><BehaviorTree ID="Main"><SubTree ID="Talk" param="{myParam}" heard="{finalHeard}"/></BehaviorTree></root>`;
  const r = new Runner({ xml, nodes });
  r.blackboard.set('myParam', 5);
  const res = r.runUntilFinished();
  eq(res.status, 'SUCCESS');
  eq(r.blackboard.get('finalHeard', 'string'), 'got5');
});
ok('autoremap', () => {
  const nodes = {
    P: {
      type: 'action',
      ports: [{ dir: 'input', name: 'x', type: 'int' }],
      tick: (ctx) => {
        ctx.blackboard.set('shared', ctx.getInput('x', 'int') + 1);
        return 'SUCCESS';
      },
    },
  };
  const xml = `<root main_tree_to_execute="Main"><BehaviorTree ID="Sub"><P name="P2" x="3"/></BehaviorTree><BehaviorTree ID="Main"><SubTree ID="Sub" name="S" _autoremap="1"/></BehaviorTree></root>`;
  const r = new Runner({ xml, nodes });
  r.runUntilFinished();
  eq(r.blackboard.get('shared', 'int'), 4);
});

out('== virtual stateful / commands ==');
ok('stateful action running across ticks', () => {
  const nodes = {
    A: {
      type: 'stateful',
      onStart: (ctx) => { ctx.blackboard.set('started', 1); return 'RUNNING'; },
      onRunning: (ctx) => {
        const prev = ctx.blackboard.tryGet('ticks');
        ctx.blackboard.set('ticks', (prev.present ? prev.value : 0) + 1);
        return 'RUNNING';
      },
      onHalted: (ctx) => ctx.blackboard.set('halted', 1),
    },
  };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><A/></BehaviorTree></root>`, nodes });
  const res = r.runUntilFinished(4);
  eq(r.blackboard.get('ticks', 'int'), 3);
  eq(res.status, 'RUNNING');
});
ok('command node round-trip', () => {
  const cmd = {
    _scheduled: false, _cancelled: false, elapsed: 0,
    update() { this.elapsed += 50; if (this.elapsed >= 200) this._scheduled = false; },
  };
  const nodes = {
    Grab: {
      type: 'command',
      ports: [{ dir: 'input', name: 'ms', type: 'int' }],
      supplier: () => cmd,
    },
  };
  const r = new Runner({
    xml: `<root><BehaviorTree ID="T"><Grab ms="200"/></BehaviorTree></root>`,
    nodes,
    beforeTick: (runner) => { cmd.update(); },
  });
  const res = r.runUntilFinished(10);
  eq(res.status, 'SUCCESS');
  eq(cmd._cancelled, false);
  eq(r.tally().find((x) => x.name === 'Grab').count, 4); // onStart (tick 1) + 3 onRunning polls
});

out('== xml errors ==');
ok('unknown node error', () => {
  let threw = false;
  try { createTreeFromText(`<root><BehaviorTree ID="T"><Unkown/></BehaviorTree></root>`, {}); } catch { threw = true; }
  if (!threw) throw new Error('must reject unknown node');
});
ok('two root children error', () => {
  let threw = false;
  try { createTreeFromText(`<root><BehaviorTree ID="T"><A/><B/></BehaviorTree></root>`, { nodes: { A: { type: 'action' }, B: { type: 'action' } } }); } catch { threw = true; }
  if (!threw) throw new Error('must reject two root children');
});
ok('doctype rejected like upstream', () => {
  let threw = false;
  try { createTreeFromText(`<!DOCTYPE root><root><BehaviorTree ID="T"><AlwaysSuccess/></BehaviorTree></root>`, {}); } catch { threw = true; }
  if (!threw) throw new Error('must reject DOCTYPE (XXE hardening)');
});

out('== errors in ticks ==');
ok('exception wraps in NodeExecutionError', () => {
  const nodes = { A: { type: 'action', tick: () => { throw new Error('boom'); } } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><A/></BehaviorTree></root>`, nodes });
  let e = null;
  try { r.tick(); } catch (x) { e = x; }
  eq(e?.name, 'NodeExecutionError');
  if (e && !e.message.includes('boom')) throw new Error('missing cause: ' + e.message);
});
ok('SyncAction must not return RUNNING', () => {
  const nodes = { A: { type: 'action', tick: () => 'RUNNING' } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><A name="A2"/></BehaviorTree></root>`, nodes });
  let e = null;
  try { r.tick(); } catch (x) { e = x; }
  eq(e?.kind, 'LogicError');
});
ok('root blackboard escape @key', () => {
  const nodes = { S: { type: 'action', tick: (ctx) => { ctx.blackboard.set('@rooted', 77); return 'SUCCESS'; } } };
  const r = new Runner({ xml: `<root><BehaviorTree ID="T"><S name="S2"/></BehaviorTree></root>`, nodes });
  r.runUntilFinished();
  eq(r.blackboard.get('@rooted', 'int'), 77);
  eq(r.blackboard.get('rooted', 'int'), 77); // lives on the root blackboard
});

export async function runTests() {
  LOG.length = 0; passed = 0; failed = 0;
  for (const [name, fn] of CASES) {
    try { fn(); passed++; out('  ✓ ' + name); }
    catch (e) { failed++; out('  ✗ ' + name + '\n      ' + (e._msg || e.message)); }
  }
  out('\n' + passed + ' passed, ' + failed + ' failed');
  return { passed, failed, log: LOG };
}
