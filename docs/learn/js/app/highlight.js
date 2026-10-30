// Lightweight syntax highlighters (XML, script-language, Java). Vanilla, no deps.
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---------------- XML ----------------
export function hlXml(src) {
  let out = '', i = 0;
  const push = (cls, t) => { out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t); };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      const t = end === -1 ? src.slice(i) : src.slice(i, end + 3);
      push('x-comment', t); i += t.length; continue;
    }
    if (src[i] === '<') {
      const end = src.indexOf('>', i);
      const t = end === -1 ? src.slice(i) : src.slice(i, end + 1);
      // split tag into parts
      const m = /^(<\/?)([\w\-.:]+)([\s\S]*?)(\/?>?)$/.exec(t);
      if (m) {
        push('x-punct', m[1]); push(m[1][1] === '/' ? 'x-endtag' : 'x-tag', m[2]);
        let rest = m[3];
        const attrRe = /([\w\-.:]+)(\s*=\s*)("[^"]*"|'[^']*')?/g; let am;
        while ((am = attrRe.exec(rest))) {
          push('x-attr', am[1]); push('x-punct', am[2]);
          if (am[3]) push('x-val', am[3]); else push('', '');
        }
        push('x-punct', m[4]);
      } else push('', t);
      i += t.length; continue;
    }
    const next = src.indexOf('<', i);
    const t = next === -1 ? src.slice(i) : src.slice(i, next);
    push('x-text', t); i += t.length;
  }
  return out;
}

// ---------------- Script language ----------------
const SCR_KW = /^(true|false)\b/;
export function hlScript(src) {
  let out = '';
  const re = /('(?:[^'\\]|\\.)')|(\s*(?::=|=|\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||[-+*/~!<>?:.|&(){}\[\],;]))|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b0x[0-9a-fA-F]+\b)|([A-Za-z_][\w]*)|(\.\.)/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span class="x-val">${esc(m[1])}</span>`;
    else if (m[2] !== undefined) {
      const leadWs = m[2].slice(0, m[2].length - m[2].trimStart().length);
      const op = m[2].trim(); out += esc(leadWs);
      if (op) out += `<span class="s-op">${esc(op)}</span>`;
    }
    else if (m[3]) out += `<span class="s-num">${esc(m[3])}</span>`;
    else if (m[4]) out += `<span class="s-num">${esc(m[4])}</span>`;
    else if (m[5]) out += SCR_KW.test(m[5]) ? `<span class="s-kw">${esc(m[5])}</span>` : `<span class="s-var">${esc(m[5])}</span>`;
    else out += esc(m[6]);
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}

// ---------------- Java ----------------
const JAVA_KW = /^(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|record|return|short|static|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false|sealed|yield)$/;
const JAVA_TYPE = /^(String|Double|Float|Integer|Long|Short|Byte|Boolean|Object|List|Map|Optional|NodeConfig|PortsList|PortInfo|NodeStatus|NodeType|TreeNode|Tree|Blackboard|BehaviorTreeFactory|Supplier|Command|Subsystem|Path|Deque|ArrayDeque|Collection|RuntimeException|Exception|Enum|Class)$/;

export function hlJava(src) {
  let out = '';
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(^\s*@\w+)|(\b\d[\d_]*(?:\.[\d_]+)?[dDfFlL]?\b|0x[\da-fA-F_]+[lL]?)|([A-Za-z_][\w]*)/gm;
  let last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span class="j-comment">${esc(m[1])}</span>`;
    else if (m[2] || m[3]) out += `<span class="j-string">${esc(m[0])}</span>`;
    else if (m[4]) out += `<span class="j-annot">${esc(m[0])}</span>`;
    else if (m[5]) out += `<span class="j-num">${esc(m[0])}</span>`;
    else if (m[6]) {
      if (JAVA_KW.test(m[6])) out += `<span class="j-kw">${esc(m[6])}</span>`;
      else if (JAVA_TYPE.test(m[6])) out += `<span class="j-type">${esc(m[6])}</span>`;
      else if (/^[A-Z]/.test(m[6])) out += `<span class="j-cls">${esc(m[6])}</span>`;
      else out += esc(m[6]);
    }
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}

export function highlight(src, lang) {
  try {
    if (lang === 'xml') return hlXml(src);
    if (lang === 'script') return hlScript(src);
    if (lang === 'java') return hlJava(src);
  } catch { /* fall through */ }
  return esc(src);
}
