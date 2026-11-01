// Content validation: runs every unit exercise's reference solution (refXml) through the engine
// and records whether its validators pass. Run: node docs/learn/_validate.mjs
import { Runner } from './js/engine/runner.js';
import { UNITS } from './js/app/curriculum.js';

let exCount = 0, exOk = 0, badNews = [];

function makeApi(r) {
  const snap = r.snapshot();
  const tally = r.tally();
  return {
    status: r.tree.rootNode.status ? r.tree.rootNode.status() : undefined,
    tickIndex: r.tickIndex,
    simMs: r.tickIndex * 50,
    blackboard: r.blackboard,
    bb: r.blackboard,
    tree: r.tree,
    runner: r,
    snapshot: snap,
    tally,
    node(nameOrPath) { return snap.find((x) => x.name === nameOrPath) || snap.find((x) => x.path === nameOrPath); },
    statusOf(nameOrPath) { const n = this.node(nameOrPath); return n ? n.status : undefined; },
    lastReturnOf(nameOrPath) { const n = this.node(nameOrPath); return n ? n.lastReturn : undefined; },
    ticksOf(nameOrPath) { const t = tally.find((x) => x.name === nameOrPath || x.path === nameOrPath); return t ? t.count : 0; },
    get(key) { return r.blackboard.typedGet(key, 'any'); },
    tryGet(key) { const x = r.blackboard.tryGet(key, 'any'); return x.present ? x.value : undefined; },
    log: r.logLines,
  };
}

for (const unit of UNITS) {
  for (const lesson of unit.lessons) {
    for (const item of lesson.items) {
      if (item.kind !== 'exercise') continue;
      exCount++;
      const w = item.workspace;
      const label = `${unit.id}/${lesson.id} — ${item.title}`;
      const xml = w.refXml ?? w.startXml;
      try {
        const r = new Runner({ xml, nodes: w.nodes || {}, enums: w.enums || {}, beforeTick: w.beforeTick });
        const res = r.runUntilFinished(w.maxTicks || 320);
        const api = makeApi(r);
        let allPass = true; const fails = [];
        for (const v of (w.validators || [])) {
          let ok, msg = '';
          try {
            const a = v.check(api);
            ok = a === true || (a && typeof a === 'object' && a.pass === true);
            if (!ok) msg = typeof a === 'string' ? a : (a?.message || '');
          }
          catch (e) { ok = false; msg = e._msg || e.message; }
          if (!ok) { allPass = false; fails.push(`${v.label} :: ${msg}`); }
        }
        if (allPass) exOk++;
        else badNews.push(`✘ EXERCISE ${label}\n   ${fails.join('\n   ')}`);
      } catch (e) {
        badNews.push(`✘ EXERCISE ${label} — crashed: ${e._msg || e.message}`);
      }
    }
  }
}

console.log(`\nExercises: ${exOk}/${exCount} reference solutions pass their own validators`);
for (const b of badNews) console.log(b + '\n');
process?.exit && (badNews.length ? process.exit(1) : process.exit(0));
