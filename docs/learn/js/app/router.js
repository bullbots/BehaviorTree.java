// Hash router: #/ , #/unit/:uid/:lessonId (/itemIdx)
import { getUnit, getLesson, UNITS } from './curriculum.js';
import { store } from './store.js';
import { renderSidebar } from './sidebar.js';
import { renderHome, renderLesson, renderNotFound } from './pages.js';

export function parseHash() {
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'home' };
  const uid = Number(parts[0]);
  if (getUnit(uid) === null) return { view: 'home' };
  if (parts.length === 1) return { view: 'unit', uid };
  const lesson = getLesson(uid, parts[1]);
  if (!lesson) return { view: 'home' };
  const idx = Math.min(+parts[2] || 0, lesson.items.length - 1);
  return { view: 'lesson', uid, lessonId: lesson.id, idx };
}

export function navigate(uid, lessonId, idx) {
  if (uid == null) { location.hash = '#/'; return; }
  location.hash = lessonId == null ? `#/${uid}` : `#/${uid}/${lessonId}/${idx ?? 0}`;
}

export function renderRoute() {
  const r = parseHash();
  const page = document.getElementById('page');
  page.innerHTML = '';
  window.scrollTo?.({ top: 0 });
  if (r.view === 'home' || r.view === 'unit') renderHome(page);
  else if (r.view === 'lesson') {
    renderLesson(page, r.uid, r.lessonId, r.idx);
    store.lastRoute.set(r.uid, r.lessonId, r.idx);
  }
  renderSidebar(r);
}
