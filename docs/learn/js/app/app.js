// App bootstrap: theme toggle, sidebar collapse, routing.
import { renderRoute } from './router.js';

const saved = localStorage.getItem('btja.theme');
if (saved === 'dark' || (!saved && window.matchMedia?.('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.dataset.theme = 'dark';
}
const themeBtn = document.getElementById('sb-theme');
function syncThemeBtn() {
  themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}
themeBtn.onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = 'dark';
  localStorage.setItem('btja.theme', dark ? 'light' : 'dark');
  syncThemeBtn();
};
syncThemeBtn();

const sbToggle = document.getElementById('sb-toggle');
sbToggle.onclick = () => document.getElementById('app').classList.toggle('sb-hidden');

window.addEventListener('hashchange', renderRoute);
renderRoute();

// keyboard shortcut: left/right arrows to navigate
window.addEventListener('keydown', (e) => {
  if (e.target.matches('textarea, input')) return;
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const btns = document.querySelectorAll('.btn-primary, .btn-ghost');
  const list = [...btns].filter((b) => !b.disabled && b.offsetParent);
  const target = e.key === 'ArrowRight' ? list[list.length - 1] : list[0];
  if (target) target.click();
});
