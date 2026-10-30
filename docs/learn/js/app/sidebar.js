// Sidebar curriculum tree (Codecademy-style).
import { UNITS } from './curriculum.js';
import { store } from './store.js';
import { navigate } from './router.js';

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="7" fill="#0b1a24"/><path d="M6 8h8v5H6zm0 9h8v5H6z" fill="#34b3a0"/><path d="M19 13.5h7v5h-7z" fill="#f65a5b"/><path d="M14 10.5h1.5v4h3.5v1.5h-4v2h-1z" fill="#e9eaea"/><path d="M15.5 16h3.5v1.5h-3.5z" fill="#e9eaea"/></svg>`;

export function renderSidebar(route) {
  const brand = document.getElementById('sb-brand');
  brand.innerHTML = `${LOGO}<div class="brand-text">
      <div class="brand-title">BehaviorTree.java<br>Academy</div>
      <div class="brand-sub">FRC behavior trees, locally</div>
    </div>`;
  brand.onclick = () => navigate(null);

  const nav = document.getElementById('sb-nav');
  nav.innerHTML = '';
  const units = UNITS.map((u, i) => ({ i, u }));

  for (const { i, u } of units) {
    const uid = u.id;
    const done = u.lessons.length > 0 && u.lessons.every((l) => store.lessonDone(uid, l));
    const unitEl = document.createElement('div');
    const isOpen = route.view === 'lesson' && Number(route.uid) === uid || route.view === 'unit' && Number(route.uid) === uid;
    unitEl.className = 'sb-unit' + (done ? ' done' : '') + (isOpen ? '' : ' closed');

    const head = document.createElement('div');
    head.className = 'sb-unit-head';
    head.innerHTML = `<span class="sb-unit-num">${done ? '✓' : uid}</span>
      <span>${u.title}</span><span class="chev">▼</span>`;
    head.onclick = () => navigate(uid);
    unitEl.appendChild(head);

    const bar = document.createElement('div');
    bar.className = 'sb-progressbar';
    bar.innerHTML = `<i style="width:${store.unitPercent(uid, u)}%"></i>`;
    unitEl.appendChild(bar);

    const list = document.createElement('div');
    list.className = 'sb-unit-list';
    for (const l of u.lessons) {
      const doneL = store.lessonDone(uid, l);
      const active = route.view === 'lesson' && Number(route.uid) === uid && route.lessonId === l.id;
      const le = document.createElement('div');
      le.className = 'sb-lesson' + (doneL ? ' done' : '') + (active ? ' active' : '');
      le.innerHTML = `<span class="ring"></span><span>${l.title}</span>`;
      le.onclick = () => navigate(uid, l.id, 0);
      list.appendChild(le);

      if (active) {
        const kinds = document.createElement('div');
        kinds.className = 'sb-item-kinds';
        l.items.forEach((item, idx) => {
          const k = document.createElement('div');
          k.className = 'sb-kind' + (store.isDone(`${uid}/${l.id}/${idx}`) ? ' done' : '') + (route.idx === idx ? ' active' : '');
          const label = item.kind === 'quiz' ? 'Quiz' : item.kind === 'exercise' ? 'Practice' : item.kind === 'java' ? 'Code study' : 'Reading';
          k.innerHTML = `<span class="dot"></span><span class="k-tag">${label}</span><span style="opacity:.6">${item.title}</span>`;
          k.onclick = (e) => { e.stopPropagation(); navigate(uid, l.id, idx); };
          kinds.appendChild(k);
        });
        list.appendChild(kinds);
      }
    }
    unitEl.appendChild(list);
    nav.appendChild(unitEl);
  }
}
