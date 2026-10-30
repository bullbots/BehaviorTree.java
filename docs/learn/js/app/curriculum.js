// Registry: imports each unit's content file, exposes UNITS/navigation helpers.
import u1 from './units/unit1.js';
import u2 from './units/unit2.js';
import u3 from './units/unit3.js';
import u4 from './units/unit4.js';
import u5 from './units/unit5.js';
import u6 from './units/unit6.js';
import u7 from './units/unit7.js';
import u8 from './units/unit8.js';
import u9 from './units/unit9.js';

export const UNITS = [u1, u2, u3, u4, u5, u6, u7, u8, u9].sort((a, b) => a.id - b.id);
export const TOTAL_ITEMS = UNITS.reduce((n, u) => n + u.lessons.reduce((m, l) => m + l.items.length, 0), 0);

export function getUnit(uid) { return UNITS.find((u) => u.id === Number(uid)) || null; }

export function getLesson(uid, lessonId) {
  const u = getUnit(uid);
  return u ? u.lessons.find((l) => l.id === lessonId) : null;
}
