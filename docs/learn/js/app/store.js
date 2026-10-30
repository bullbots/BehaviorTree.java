// Progress + settings persistence (localStorage)
const KEY = 'btja.prog.v1';

const state = (() => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
})();
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

export const store = {
  // itemKey = `${unitId}/${lessonId}/${itemIndex}`
  isDone(key) { return !!state.done?.[key]; },
  markDone(key) {
    state.done ??= {};
    if (!state.done[key]) { state.done[key] = Date.now(); save(); }
  },
  unDone(key) { if (state.done) { delete state.done[key]; save(); } },
  // quiz answers, exercise solutions: key -> payload
  store(key, value) { state.data ??= {}; state.data[key] = value; save(); },
  loadData(key) { return state.data?.[key]; },
  unitPercent(uid, unit) {
    let total = 0, done = 0;
    for (const l of unit().lessons) for (let i = 0; i < l.items.length; i++) {
      total++;
      if (this.isDone(`${uid}/${l.id}/${i}`)) done++;
    }
    return total ? Math.round(100 * done / total) : 0;
  },
  lessonDone(uid, lesson) {
    return lesson.items.every((_, i) => this.isDone(`${uid}/${lesson.id}/${i}`));
  },
  lastRoute: {
    get() {
      if (state.data?.last) {
        const u = getUnit(state.data.last.unit);
        if (u || state.data.last.unit === null) return state.data.last;
      }
      return null;
    },
    set(unit, lesson, idx) { state.data ??= {}; state.data.last = { unit, lesson, idx }; save(); },
  },
  reset() { localStorage.removeItem(KEY); location.hash = '#/'; location.reload(); },
};

import { getUnit } from './curriculum.js';
