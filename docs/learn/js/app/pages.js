// Home + lesson pages (reading, quiz, java-study, exercise).
import { UNITS, getUnit, getLesson } from './curriculum.js';
import { store } from './store.js';
import { renderSidebar } from './sidebar.js';
import { navigate } from './router.js';
import { renderBlocks, mdInline } from './render.js';

const ITEM_LABEL = { reading: 'Reading', quiz: 'Quiz', exercise: 'Practice', java: 'Code study' };

const TOTAL = (() => { let n = 0; for (const u of UNITS) for (const l of u.lessons) n += l.items.length; return n; })();
function completedItems() { let n = 0; for (const u of UNITS) for (const l of u.lessons) for (let i = 0; i < l.items.length; i++) if (store.isDone(`${u.id}/${l.id}/${i}`)) n++; return n; }
function storePercent() { return TOTAL ? Math.round(100 * completedItems() / TOTAL) : 0; }

/* ---------------- HOME ---------------- */
export function renderHome(page) {
  page.innerHTML = '';
  const last = store.lastRoute.get();
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.innerHTML = `
    <h1>Learn behavior trees. Program FRC robots smarter.</h1>
    <p>A complete, offline course on the <b>BehaviorTree.java</b> engine and its <b>WPILib</b>
    integration — with a live simulator so you write real XML trees and real script code,
    and watch every single tick.</p>
    <div class="hero-cta">
      <button class="btn btn-primary" id="home-continue">${last && last.unit ? 'Continue where you left off →' : 'Start Unit 1 →'}</button>
      <button class="btn btn-ghost" id="home-browse" style="border-color:rgba(255,255,255,.3);color:#cfd8dd">Browse curriculum</button>
      <span style="color:#7f97a3;font-size:12.5px;margin-left:6px">${storePercent()}% complete · ${completedItems()}/${TOTAL} items</span>
    </div>`;
  page.appendChild(hero);

  const title = document.createElement('div');
  title.className = 'home-section-title';
  title.textContent = 'Spiral curriculum · 9 units';
  page.appendChild(title);

  const cards = document.createElement('div');
  cards.className = 'unit-cards';
  for (const u of UNITS) {
    const p = store.unitPercent(u.id, u);
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.innerHTML = `
      <div class="uc-num" style="background:${p === 100 ? 'var(--teal)' : u.color || '#34b3a0'}">${p === 100 ? '✓' : u.id}</div>
      <h3>${u.title}</h3>
      <p>${u.tagline || ''}</p>
      <div class="uc-bar"><i style="width:${p}%"></i></div>
      <div class="uc-meta"><span>${u.lessons.length} lessons</span><span>${p}%</span></div>`;
    card.onclick = () => navigate(u.id);
    cards.appendChild(card);
  }
  page.appendChild(cards);

  const reset = document.createElement('div');
  reset.style.cssText = 'margin-top:38px;text-align:center';
  reset.innerHTML = `<button class="btn btn-ghost" style="font-size:12.5px">Reset all progress</button>`;
  reset.querySelector('button').onclick = () => { if (confirm('Really delete all local progress?')) store.reset(); };
  page.appendChild(reset);

  document.getElementById('home-continue').onclick = () => {
    const l = store.lastRoute.get();
    if (l && l.unit) navigate(l.unit, l.lesson, l.idx ?? 0);
    else navigateUnitFirst(UNITS[0].id);
  };
  document.getElementById('home-browse').onclick = () => navigateUnitFirst(1);
}

function navigateUnitFirst(uid) {
  const u = getUnit(uid);
  navigate(uid, u.lessons[0]?.id, 0);
}

/* ---------------- LESSON ---------------- */
export function renderLesson(page, uid, lessonId, idx) {
  const unit = getUnit(uid), lesson = getLesson(uid, lessonId);
  if (!unit || !lesson) { renderNotFound(page); return; }
  const item = lesson.items[idx];
  const itemKey = `${uid}/${lessonId}/${idx}`;

  const crumb = document.createElement('div');
  crumb.className = 'crumb';
  crumb.innerHTML = `<a href="#/">My Learning</a><span class="sep">›</span>
    <a href="#/${uid}">${unit.title}</a><span class="sep">›</span>
    <span>${lesson.title}</span><span class="sep">›</span>
    <span style="color:var(--accent);font-weight:700">${ITEM_LABEL[item.kind] || 'Item'} ${idx + 1} of ${lesson.items.length}</span>`;
  page.appendChild(crumb);

  const bar = document.createElement('div');
  bar.className = 'lesson-progress';
  bar.innerHTML = `<i style="width:${lessonProgress(uid, lesson)}%"></i>`;
  page.appendChild(bar);

  const h1 = document.createElement('h1');
  h1.className = 'lesson-title';
  h1.textContent = item.title || lesson.title;
  page.appendChild(h1);

  const body = document.createElement('div');
  page.appendChild(body);

  const finish = () => { store.markDone(itemKey); renderSidebar({ view: 'lesson', uid, lessonId, idx }); updateBar(); updateNavRow(); };

  if (item.kind === 'reading' || item.kind === 'java') {
    renderBlocks(body, item.blocks);
  } else if (item.kind === 'quiz') {
    renderQuiz(body, item, () => finish(), `${uid}/${lessonId}/${idx}`);
  } else if (item.kind === 'exercise') {
    import('./workspace.js').then((ws) => ws.renderExercise(body, item, finish, page));
  }

  const barEl = bar.querySelector('i');
  function updateBar() { barEl.style.width = lessonProgress(uid, lesson) + '%'; }

  function findRel(delta) {
    const ni = idx + delta;
    if (ni >= 0 && ni < lesson.items.length) return { uid, lessonId, idx: ni };
    for (let li = lessonIdToPos() + Math.sign(delta); li >= 0 && li < unit.lessons.length; li += Math.sign(delta)) {
      const l = unit.lessons[li];
      if (l.items.length) return { uid, lessonId: l.id, idx: delta > 0 ? 0 : l.items.length - 1 };
      if (delta < 0 && li === 0) break;
    }
    // wrap at unit boundary: no explicit crossing units (Codecademy-style "Unit finish")
    return null;
    function lessonIdToPos() { for (let i = 0; i < unit.lessons.length; i++) if (unit.lessons[i].id === lessonId) return i; return 0; }
  }

  const navRow = document.createElement('div');
  navRow.style.cssText = 'display:flex;gap:12px;justify-content:space-between;margin-top:34px';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-ghost'; prevBtn.textContent = '← Previous';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  navRow.appendChild(prevBtn); navRow.appendChild(nextBtn);
  page.appendChild(navRow);

  function updateNavRow() {
    const prev = findRel(-1);
    prevBtn.disabled = !prev;
    if (prev) prevBtn.onclick = () => navigate(prev.uid, prev.lessonId, prev.idx);
    const next = findRel(1);
    if (next) {
      const nxt = getLesson(next.uid, next.lessonId).items[next.idx];
      const tag = nxt.kind === 'quiz' ? 'Quiz — ' : nxt.kind === 'exercise' ? 'Practice — ' : '';
      nextBtn.textContent = `Next: ${tag}${nxt.title}`;
      nextBtn.onclick = () => navigate(next.uid, next.lessonId, next.idx);
    } else {
      nextBtn.textContent = 'Unit finish →';
      nextBtn.onclick = () => {
        navigate(uid); // show home/unit cards
        if (store.lessonDone(uid, lesson)) renderUnitComplete(unit);
      };
      nextBtn.disabled = false;
      if (store.lessonDone(uid, lesson)) {
        nextBtn.innerHTML = 'Complete lesson <span style="font-weight:400">✓</span>';
      }
    }
  }
  updateNavRow();
}

export function lessonProgress(uid, lesson) {
  let done = 0;
  for (let i = 0; i < lesson.items.length; i++) if (store.isDone(`${uid}/${lesson.id}/${i}`)) done++;
  return lesson.items.length ? Math.round(100 * done / lesson.items.length) : 0;
}

/* -------- quiz -------- */
function renderQuiz(body, item, onDone, keyPrefix) {
  let doneCount = item.questions.filter((q) => store.loadData(`${keyPrefix}:q:${q.q}`) !== undefined).length;
  const banner = document.createElement('div');
  banner.className = 'lesson-complete';
  banner.style.display = 'none';

  item.questions.forEach((q, qi) => {
    const ql = document.createElement('div');
    ql.className = 'quiz-q';
    const qText = document.createElement('div');
    qText.className = 'q-text';
    qText.innerHTML = mdInline(`${qi + 1}. ${q.q}`);
    ql.appendChild(qText);
    const opts = document.createElement('div');
    opts.className = 'q-opts';
    const explain = document.createElement('div');
    explain.className = 'quiz-explain';

    q.options.forEach((opt, oi) => {
      const o = document.createElement('div');
      o.className = 'quiz-opt';
      o.innerHTML = `<span class="bub">✓</span><span>${mdInline(opt)}</span>`;
      o.onclick = () => {
        if (oi === q.correct) {
          opts.querySelectorAll('.wrong').forEach((x) => x.classList.remove('wrong'));
          o.classList.add('correct');
          explain.style.display = 'block';
          explain.className = 'quiz-explain good';
          explain.innerHTML = `<b>✔ Correct.</b> ${mdInline(q.explain || '')}`;
          if (store.loadData(`${keyPrefix}:q:${q.q}`) === undefined) { store.store(`${keyPrefix}:q:${q.q}`, true); doneCount++; }
          if (doneCount === item.questions.length) {
            banner.style.display = 'flex';
            setTimeout(() => banner.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
            onDone();
          }
        } else {
          o.classList.add('wrong');
          explain.style.display = 'block';
          explain.className = 'quiz-explain bad';
          explain.innerHTML = `<b>✘ Not quite.</b> ${mdInline(q.hint || 'Re-read the section this question comes from, then try again.')}`;
        }
      };
      opts.appendChild(o);
    });
    ql.appendChild(opts);
    ql.appendChild(explain);
    body.appendChild(ql);
  });

  banner.innerHTML = `<div class="big-check">✓</div><div><h3>Quiz complete!</h3><p>Great progress. Use the Next button to continue.</p></div><div class="next"></div>`;
  body.appendChild(banner);
}

/* -------- unit celebration -------- */
function renderUnitComplete(unit) {
  const done = document.createElement('div');
  done.className = 'lesson-complete';
  done.style.marginTop = '-8px';
  done.innerHTML = `<div class="big-check">✓</div>
    <div><h3>Unit ${unit.id} lessons finished!</h3>
    <p>${unit.title } — pick any completed unit from the cards above, or start the next one to keep spiraling.</p></div>
    <div class="next"></div>`;
  const main = document.getElementById('main');
  main.appendChild(done);
  setTimeout(() => { done.style.transition = 'opacity .8s'; done.style.opacity = '0'; setTimeout(() => done.remove(), 900); }, 4200);
}

export function renderNotFound(page) {
  page.innerHTML = '<h1 class="lesson-title">Not found</h1><p>This page does not exist — <a href="#/">back home</a>.</p>';
}
