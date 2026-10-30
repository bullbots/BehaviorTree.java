// The lesson workspace: XML editor + live tree visualizer + blackboard inspector + grader.
import { Runner } from '../engine/runner.js';
import { STATUS } from '../engine/clock.js';
import { highlight } from './highlight.js';
import { mdInline } from './render.js';

const STATUS_UI = {
  RUNNING: { bg: '#2a4d75', fg: '#bfe0ff', label: 'RUNNING' },
  SUCCESS: { bg: '#1d5c50', fg: '#9ef0de', label: 'SUCCESS' },
  FAILURE: { bg: '#6e2728', fg: '#ffb8b8', label: 'FAILURE' },
  SKIPPED: { bg: '#3a4652', fg: '#c3cdd8', label: 'SKIPPED' },
  IDLE: { bg: '#21303b', fg: '#8fa3ae', label: 'IDLE' },
};
const KIND_UI = { CONTROL: '#4a90d9', DECORATOR: '#b07ad9', ACTION: '#34b3a0', CONDITION: '#ffc94d', SUBTREE: '#8fa3ae' };

export function renderExercise(body, item, finish, page) {
  const cfg = item.workspace;
  const uid = DC('div', 'exercise-shell');

  // brief and tasks
  const brief = DC('div');
  brief.style.cssText = 'font-size:15.5px;line-height:1.65;margin-bottom:12px';
  brief.innerHTML = mdInline(cfg.brief || '');
  uid.appendChild(brief);
  if (cfg.tasks?.length) {
    const ul = DC('ul', 'task-list');
    for (const t of cfg.tasks) ul.appendChild(DCLi(t));
    uid.appendChild(ul);
  }

  // hints
  let hintIdx = 0;
  const hintBox = DC('div', 'hint-box');
  const hintBtn = DC('button', 'btn btn-ghost', 'Need a hint?');
  hintBtn.style.margin = '0 0 18px';
  const hintRow = DC('div');
  hintRow.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:16px';
  hintRow.appendChild(hintBtn);
  uid.appendChild(hintRow);
  hintBtn.onclick = () => {
    if (hintIdx < (cfg.hints?.length || 0)) {
      hintBox.style.display = 'block';
      hintBox.innerHTML = `<b>Hint ${hintIdx + 1} / ${cfg.hints.length}</b>${mdInline(cfg.hints[hintIdx])}`;
      hintBox.className = 'hint-box show';
      hintIdx++;
      hintBtn.textContent =HintLabel(hintIdx, cfg.hints.length);
    } else { hintBtn.disabled = true; hintBtn.textContent = 'No more hints'; }
  };
  uid.appendChild(hintBox);

  // grading banner
  const banner = DC('div', 'grade-banner');
  uid.appendChild(banner);

  // ===== workspace grid =====
  const grid = DC('div', 'ws-grid');
  uid.appendChild(grid);
  body.appendChild(uid);

  const editorPane = DC('div', 'ws-pane editor');
  const visPane = DC('div', 'ws-pane viz');

  grid.appendChild(editorPane);
  grid.appendChild(visPane);

  /* -------- editor -------- */
  const edHead = DC('div', 'cb-head');
  edHead.innerHTML = `<span>XML · your behavior tree</span>`;
  const edWrap = DC('div', 'ed-wrap');
  const edPre = DC('pre', 'ed-pre');
  const edArea = DC('textarea', 'ed-area');
  edArea.spellcheck = false;
  edArea.value = cfg.startXml || '';
  edWrap.appendChild(edPre); edWrap.appendChild(edArea);
  editorPane.appendChild(edHead); editorPane.appendChild(edWrap);
  const syncHl = () => { edPre.innerHTML = highlight(edArea.value + '\n', 'xml'); };
  edArea.addEventListener('input', syncHl);
  edArea.addEventListener('scroll', () => { edPre.scrollTop = edArea.scrollTop; edPre.scrollLeft = edArea.scrollLeft; });
  syncHl();

  /* -------- controls -------- */
  const runBtn = DC('button', 'btn btn-primary', '▶ Run');
  const stepBtn = DC('button', 'btn btn-ghost', 'Step 1 tick');
  const resetBtn = DC('button', 'btn btn-ghost', '⟲ Reset');
  const checkBtn = DC('button', 'btn btn-teal', '✔ Run & check');
  const speedSel = document.createElement('select');
  speedSel.className = 'btn btn-ghost ws-speed';
  for (const [label, ms] of [['Wide jet (fast)', 90], ['Normal', 220], ['Slow', 420]]) {
    const o = document.createElement('option'); o.value = String(ms); o.textContent = label; speedSel.appendChild(o);
  }
  const clockLabel = DC('span', 'ws-clock', 'robot @ 0.0s · tick 0');
  const controls = DC('div', 'ws-controls');
  controls.appendChild(runBtn); controls.appendChild(stepBtn); controls.appendChild(resetBtn);
  controls.appendChild(clockLabel);
  const controls2 = DC('div', 'ws-controls');
  controls2.appendChild(checkBtn); controls2.appendChild(speedSel);
  controls.style.justifyContent = 'flex-start';
  controls2.style.justifyContent = 'flex-start';
  visPane.appendChild(controls);
  visPane.appendChild(controls2);

  /* -------- viz areas -------- */
  const treeWrap = DC('div', 'ws-tree');
  const bbWrap = DC('div', 'ws-bb');
  const consoleWrap = DC('div', 'ws-console');
  const errWrap = DC('div', 'ws-errors');
  visPane.appendChild(treeWrap);
  visPane.appendChild(errWrap);
  visPane.appendChild(bbWrap);
  visPane.appendChild(consoleWrap);

  let runner = null;
  let interval = null;

  function makeRunner() {
    stopLoop();
    try {
      runner = new Runner({ xml: edArea.value, nodes: cfg.nodes || {}, enums: cfg.enums || {}, beforeTick: cfg.beforeTick });
      runner.render = { clockLabel };
      treeWrap.classList.remove('ws-flash');
      return runner;
    } catch (e) {
      showErr(e);
      runner = null;
      return null;
    }
  }

  function showErr(e) {
    errWrap.style.display = 'block';
    errWrap.textContent = '';
    const div = DC('div', 'ws-error');
    div.textContent = `${e.name?.replace('Error','') || 'Error'}: ${e._msg || e.message}`;
    errWrap.appendChild(div);
  }
  function hideErr() { errWrap.style.display = 'none'; errWrap.textContent = ''; }

  function tickOnce() {
    if (!runner) makeRunner();
    if (!runner) return null;
    hideErr();
    try {
      const r = runner.tick();
      return r;
    } catch (e) {
      showErr(e);
      stopLoop();
      return null;
    }
  }

  function renderAll(res) {
    if (!runner) return;
    const snap = runner.snapshot();
    clockLabel.textContent = `robot @ ${(res?.simMs ?? 0) / 1000}s · tick ${res?.tickIndex ?? 0}`;
    renderTree(snap, res);
    renderBB(res);
    renderConsole();
  }

  function renderTree(snap, res) {
    treeWrap.innerHTML = '';
    const byPath = Object.create(null);
    for (const n of snap) byPath[n.path] = n;
    const build = (node, depth) => {
      const d = STATUS_UI[node.status] || STATUS_UI.IDLE;
      const card = DC('div', 'tn');
      card.id = 'tn-' + node.uid;
      card.style.borderLeftColor = KIND_UI[node.kind] || '#666';
      if (node.status === 'RUNNING') card.classList.add('running');
      if (node.status === 'SUCCESS') card.classList.add('done');
      if (node.status === 'FAILURE') card.classList.add('failed');
      if (node.status === 'SKIPPED') card.classList.add('skipped');
      const left = DC('div', 'tn-head');
      left.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;flex:0 0 8px;background:${KIND_UI[node.kind] || '#999'}"></span>
        <span class="tn-name">${escapeH(node.name)}</span>
        <span class="tn-reg">${escapeH(node.reg || node.name)}</span>`;
      const pill = DC('span', 'tn-status');
      pill.style.background = d.bg; pill.style.color = d.fg;
      pill.textContent = node.lastReturn && node.lastReturn !== node.status ? `${node.lastReturn}` : d.label;
      left.appendChild(pill);
      card.appendChild(left);
      const kids = snap.filter((x) => x.parent === node.path);
      if (kids.length) {
        const kc = DC('div', `tn-kids ${kids.length > 1 ? 'branches' : 'single'}`);
        for (const k of kids) kc.appendChild(build(k, depth + 1));
        card.appendChild(kc);
      }
      return card;
    };
    const rootSnap = snap.find((s) => !s.parent);
    if (rootSnap) {
      const t = build(rootSnap, 0);
      t.classList.add('root');
      treeWrap.appendChild(t);
    }
    if (res) {
      const hi = document.getElementById('tn-' + (runner._lastTouchedUid ?? ''));
      if (hi) { hi.classList.add('ticked'); setTimeout(() => hi.classList.remove('ticked'), 350); }
    }
  }

  function renderBB(res) {
    bbWrap.innerHTML = '';
    const bb = runner.blackboard;
    const head = DC('div', 'ws-bb-head', `Blackboard (${(res?.simMs ?? 0) / 1000}s)`);
    bbWrap.appendChild(head);
    let count = 0;
    const collect = (bb, depth, label) => {
      for (const e of bb.entries.values()){
        if (e.value === undefined) continue;
        count++;
        const row = DC('div', 'bb-row');
        const key = DC('span', 'bb-key', depth ? `${label ?? ''}${e.key}` : e.key);
        const val = DC('span', 'bb-val', typeof e.value === 'object' ? '[queue]' : String(e.value));
        const ty = DC('span', 'bb-type', e.type ?? '?');
        row.appendChild(key); row.appendChild(val); row.appendChild(ty);
        bbWrap.appendChild(row);
      }
      // child blackboards only visible through subtree refs (this engine builds them on demand)
      if (bb.entries.size === 0 && depth === 0) {
        const row = DC('div', 'bb-row');
        row.innerHTML = `<span style="opacity:.55">empty — nothing has been stored yet</span>`;
        bbWrap.appendChild(row);
      }
    };
    collect(bb, 0, '');
  }

  function renderConsole() {
    consoleWrap.innerHTML = '';
    const lines = runner.logLines || [];
    if (runner._tickTrace) {
      for (const l of runner._tickTrace) consoleWrap.appendChild(DC('div', 'ws-log', l));
    }
    if (lines.length) {
      for (const l of lines) consoleWrap.appendChild(DC('div', 'ws-log', l));
    }
    consoleWrap.scrollTop = consoleWrap.scrollHeight;
  }

  /* -------- control wiring -------- */
  function startLoop() {
    stopLoop();
    if (!runner) makeRunner();
    if (!runner) return;
    const ms = Number(speedSel.value);
    interval = setInterval(() => {
      const r = tickOnce();
      if (r) {
        renderTree(runner.snapshot(), r);
        renderBB(r); renderConsole();
        if (r.status === 'SUCCESS' || r.status === 'FAILURE') stopLoop();
      } else stopLoop();
    }, ms);
  }
  function stopLoop() { if (interval) { clearInterval(interval); interval = null; } }

  runBtn.onclick = () => {
    if (interval) { stopLoop(); runBtn.textContent = '▶ Run'; return; }
    makeRunner();
    runBtn.textContent = '⏸ Pause';
    startLoopManual();
  };
  function startLoopManual() { startLoop(); runBtn.textContent = '⏸ Pause'; }

  stepBtn.onclick = () => { const r = tickOnce(); if (r) renderAll(r); };
  resetBtn.onclick = () => { stopLoop(); makeRunner(); renderAll({ simMs: 0, tickIndex: 0 }); runBtn.textContent = '▶ Run'; };

  checkBtn.onclick = () => {
    stopLoop();
    banner.style.display = 'block';
    banner.className = 'grade-banner';
    banner.innerHTML = '<b>Running your tree…</b>';
    runner = null;
    setTimeout(() => runChecks(), 60);
  };

  function runChecks() {
    const r = makeRunner();
    if (!r) { banner.className = 'grade-banner fail'; banner.innerHTML = '<b>✘ Fix the XML errors above, then Run & check again.</b>'; return; }
    let result = null;
    try {
      result = r.runUntilFinished(cfg.maxTicks || 320);
    } catch (e) {
      banner.className = 'grade-banner fail';
      banner.innerHTML = `<b>✘ Your tree crashed while running.</b><pre>${escapeH(e._msg || e.message)}</pre>`;
      showErr(e);
      return;
    }
    renderAll(result);
    const api = makeApi(r);
    const results = [];
    let allPass = true;
    for (const v of cfg.validators || []) {
      let ok, msg = '';
      try { const answer = v.check(api); ok = answer === true || (answer && answer.pass === true); if (answer !== true && answer?.message) msg = answer.message; }
      catch (e) { ok = false; msg = e._msg || e.message; }
      if (ok) results.push(`✔ ${v.label}`);
      else { allPass = false; results.push(`✘ ${v.label}${msg ? ' — ' + msg : ''}`); }
    }
    banner.className = 'grade-banner ' + (allPass ? 'pass' : 'fail');
    if (allPass) {
      banner.innerHTML = `<b>✔ All checks passed!</b> ${results.map((s) => s).join('<br>')}<br>Press the Next button below to continue.`;
      banner.onclick = () => {};
      finish && finish();
    } else {
      banner.innerHTML = `<b>Almost there — some checks failed.</b><pre>${escapeH(results.filter((s) => s.startsWith('✘')).join('\n'))}</pre>Hints below; edit the XML and Run & check again.`;
    }
  }

  function makeApi(r) {
    const snap = r.snapshot();
    const tally = r.tally();
    return {
      status: r.tree.rootNode.status ? r.tree.rootNode.status() : undefined,
      tickIndex: r.tickIndex,
      simMs: simMsOf(r),
      blackboard: r.blackboard,
      bb: r.blackboard,
      tree: r.tree,
      runner: r,
      snapshot: snap,
      tally,
      node(nameOrPath) { return byNode(snap, nameOrPath); },
      statusOf(nameOrPath) { const n = byNode(snap, nameOrPath); return n ? n.status : undefined; },
      lastReturnOf(nameOrPath) { const n = byNode(snap, nameOrPath); return n ? n.lastReturn : undefined; },
      ticksOf(nameOrPath) { const t = tally.find((x) => x.name === nameOrPath || x.path === nameOrPath); return t ? t.count : 0; },
      get(key) { return r.blackboard.typedGet(key, 'any'); },
      tryGet(key) { const x = r.blackboard.tryGet(key, 'any'); return x.present ? x.value : undefined; },
      log: r.logLines,
    };
  }

  function simMsOf(r) { return r.tickIndex * 50; }

  renderAll({ simMs: 0, tickIndex: 0 });

  return { runChecks };
}

function HintLabel(idx, total) { return `Another hint? (${idx}/${total})`; }
function byNode(snap, nameOrPath) { return snap.find((x) => x.name === nameOrPath) || snap.find((x) => x.path === nameOrPath); }
function DC(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; }
function DCLi(t) { const li = document.createElement('li'); li.innerHTML = mdInline(t); return li; }
function escapeH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
