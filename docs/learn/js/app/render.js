// Inline markdown-ish + reading-block renderer.
export function mdInline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderBlocks(el, blocks) {
  const frag = document.createDocumentFragment();
  for (const b of blocks || []) frag.appendChild(renderBlock(b));
  el.appendChild(frag);
}

export function renderBlock(b) {
  const div = document.createElement('div');
  div.className = 'blk';
  switch (b.t) {
    case 'p': {
      const p = document.createElement('p'); p.innerHTML = mdInline(b.md || '');
      div.appendChild(p); break;
    }
    case 'h': {
      const h = document.createElement(b.level === 3 ? 'h3' : 'h2');
      h.textContent = b.text; div.appendChild(h); break;
    }
    case 'code': {
      div.classList.remove('blk');
      const wrap = document.createElement('div'); wrap.className = 'codeblock';
      const head = document.createElement('div'); head.className = 'cb-head';
      head.innerHTML = `<span>${b.name || (b.lang === 'xml' ? 'XML' : b.lang === 'script' ? 'SCRIPT' : 'JAVA')}${b.file ? ' — ' + b.file : ''}</span>`;
      const pre = document.createElement('pre');
      import('./highlight.js').then((hl) => { pre.innerHTML = hl.highlight(b.code, b.lang || 'xml'); });
      pre.textContent = b.code; // immediately visible; upgraded async
      const copy = document.createElement('button'); copy.className = 'cb-copy'; copy.textContent = 'Copy';
      copy.onclick = () => { navigator.clipboard?.writeText(b.code); copy.textContent = 'Copied!'; setTimeout(() => copy.textContent = 'Copy', 1200); };
      head.appendChild(copy);
      wrap.appendChild(head); wrap.appendChild(pre);
      div.appendChild(wrap); break;
    }
    case 'tip': case 'note': case 'warn': {
      div.classList.remove('blk');
      div.className = 'callout ' + b.t;
      div.innerHTML = `<span class="c-label">${b.t}</span>${mdInline(b.md || '')}`;
      div.className = 'blk callout ' + b.t; break;
    }
    case 'list': {
      const ul = document.createElement('ul'); ul.className = 'blk-list';
      for (const it of b.items) { const li = document.createElement('li'); li.innerHTML = mdInline(it); ul.appendChild(li); }
      div.appendChild(ul); break;
    }
    case 'table': {
      div.classList.remove('blk');
      const t = document.createElement('table'); t.className = 'tbl';
      t.innerHTML = `<tr>${(b.cols || []).map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr>`;
      for (const row of b.rows || []) {
        t.insertAdjacentHTML('beforeend', `<tr>${row.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`);
      }
      const wrap = document.createElement('div'); wrap.appendChild(t);
      div.className = 'blk'; div.appendChild(wrap); break;
    }
    default: div.innerHTML = mdInline(String(b.md || b.text || ''));
  }
  return div;
}
