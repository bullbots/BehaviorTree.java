// Minimal XML parser usable in browser AND node (no DOMParser dependency).
// Supports: attributes ('single'/"double" quoted), self-closing tags, comments, <?xml?>,
// <!DOCTYPE> rejected (mirrors upstream's XXE-hardening), standard entities.
class XElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = [];
    this.children = [];
    this.nodeType = 1;
  }
  getAttribute(name) {
    const a = this.attributes.find((a) => a.name === name);
    return a ? a.value : null;
  }
}

export function parseXmlDoc(text) {
  let i = 0;
  const n = text.length;
  const rootStack = [];
  let result = null;
  function fail(msg) { throw new Error(msg); }
  function push(el) {
    if (!rootStack.length) {
      if (result) fail('XML must have exactly one top element');
      result = el;
      return;
    }
    rootStack[rootStack.length - 1].children.push(el);
  }
  function decode(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#x?[0-9a-fA-F]+);/g, (_, e) => {
      switch (e) {
        case 'lt': return '<'; case 'gt': return '>'; case 'amp': return '&';
        case 'quot': return '"'; case 'apos': return "'";
        default: return String.fromCodePoint(Number(e[1] === '#' ? (e[2] === 'x' || e[2] === 'X' ? '0x' + e.slice(3) : e.slice(1)) : e));
      }
    });
  }
  while (i < n) {
    const c = text[i];
    if (c === '<' && text.startsWith('<!--', i)) { const end = text.indexOf('-->', i); if (end === -1) fail('Unterminated comment'); i = end + 3; continue; }
    if (c === '<' && text.startsWith('<!', i)) return fail('DOCTYPE declarations are not allowed in tree XML (upstream rejects them for XXE hardening)');
    if (c === '<' && text.startsWith('<?', i)) { const end = text.indexOf('?>', i); if (end === -1) fail('Unterminated <?...?>'); i = end + 2; continue; }
    if (c === '<') {
      if (text[i + 1] === '/') {
        const end = text.indexOf('>', i);
        if (end === -1) fail('Unterminated closing tag');
        const tag = text.slice(i + 2, end).trim();
        const top = rootStack[rootStack.length - 1];
        if (!top) fail('Unexpected closing tag </' + tag + '>');
        if (top.tagName !== tag) fail(`Expected </${top.tagName}> but found </${tag}>`);
        rootStack.pop();
        i = end + 1;
        continue;
      }
      // open tag
      let j = i + 1, tag = '', attrs = [], stage = 'tag';
      while (j < n) {
        const d = text[j];
        if (stage === 'tag') {
          if (/\s/.test(d) || d === '>' || d === '/') { break; }
          tag += d; j++;
        } else {
          // never reached in this impl (attrs parsed below)
        }
      }
      // attributes
      j = i + 1 + tag.length; let selfClose = false;
      const attrRe = /([^\s"'>/=]+)(?:\s*=\s*("([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'))?/y;
      while (j < n) {
        while (j < n && /\s/.test(text[j])) j++;
        if (text[j] === '>') { j++; break; }
        if (text[j] === '/') {
          if (text[j + 1] !== '>') fail('Malformed self-closing tag');
          selfClose = true; j += 2; break;
        }
        attrRe.lastIndex = j;
        const m = attrRe.exec(text);
        if (!m) fail(`Bad attribute near ${text.slice(j, j + 16)}`);
        const name = m[1];
        let value = '';
        if (m[2] !== undefined) value = decode(m[3] !== undefined ? m[3].replace(/\\(.)/g, '$1') : (m[5] ?? m[1]));
        attrs.push({ name, value });
        j = attrRe.lastIndex;
      }
      const el = new XElement(tag);
      el.attributes = attrs;
      push(el);
      if (!selfClose) rootStack.push(el);
      i = j;
      continue;
    }
    // text node: ignore (trees are element-only), but disallow stray text
    const next = text.indexOf('<', i);
    if (next === -1) fail('Unexpected end of XML');
    const ws = text.slice(i, next);
    if (ws.trim()) fail(`Unexpected text in tree XML: '${ws.trim()}'`);
    i = next;
  }
  if (rootStack.length) fail(`Unclosed tag <${rootStack[rootStack.length - 1].tagName}>`);
  if (!result) fail('Empty document');
  return result;
}
