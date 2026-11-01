// Faithful JS port of org.behaviortree.core.scripting (Lexer + ScriptParser + Environment).
// Grammar: statements separated by ';', last value returned. Numbers are doubles upstream
// (BehaviorTree.java collapses int64/uint64/double); booleans and strings are first-class here.
import { RuntimeError2 } from './clock.js';

/* ------------- Lexer ------------- */
const OPS = [
  ':=','==','!=','<=','>=','&&','||','+=','-=','*=','/=','..',
  '+','-','*','/','(',')','[',']',',',';','?','!','~','<','>','=','&','|','^',':',
];

function tokenize(src) {
  const toks = [];
  let i = 0;
  const push = (type, val) => toks.push({ type, val });
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        let j = i + 2, start = i;
        while (j < src.length && /[0-9a-fA-F_]/.test(src[j])) j++;
        push('num', Number(src.slice(i + 2, j))); i = j; continue;
      }
      let j = i, seenDot = false, seenE = false;
      while (j < src.length) {
        const d = src[j];
        if (/[0-9]/.test(d)) { j++; continue; }
        if (d === '.' && !seenDot && !seenE) { seenDot = true; j++; continue; }
        if ((d === 'e' || d === 'E') && !seenE && /[0-9+\-]/.test(src[j + 1] || '')) { seenE = true; j += src[j + 1] === '+' || src[j + 1] === '-' ? 2 : 1; continue; }
        break;
      }
      push('num', Number(src.slice(i, j))); i = j; continue;
    }
    if (c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== "'") { s += src[j] === '\\' && (src[j + 1] === "'" || src[j + 1] === '\\') ? (j++, src[j]) : src[j]; j++; }
      if (j >= src.length) throw RuntimeError2(`Unterminated string literal in script`);
      push('str', s); i = j + 1; continue;
    }
    if (/[A-Za-z_@]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_@]/.test(src[j])) j++;
      push('name', src.slice(i, j)); i = j; continue;
    }
    // operators: try 2-char then 1-char
    if (i + 1 < src.length) {
      const two = src.slice(i, i + 2);
      if (OPS.includes(two)) { push('op', two); i += 2; continue; }
    }
    if (OPS.includes(c)) { push('op', c); i++; continue; }
    throw RuntimeError2(`Unexpected character in script: '${c}'`);
  }
  push('eof', null);
  return toks;
}

/* ------------- Parser (Pratt) ------------- */
const BP = {
  ':=': 2, '=': 2, '+=': 2, '-=': 2, '*=': 2, '/=': 2,
  '?': 4, '||': 6, '&&': 8, '==': 10, '!=': 10, '<': 10, '>': 10, '<=': 10, '>=': 10,
  '|': 12, '^': 12, '&': 14, '+': 16, '-': 16, '..': 16, '*': 18, '/': 18,
};
const ASSIGN_OPS = [':=', '=', '+=', '-=', '*=', '/='];
const COMPARISON_OPS = ['==','!=','<','>','<=','>='];
const UNARY = ['-', '~', '!'];

export function parseScriptTree(src) {
  if (!src || !src.trim()) throw RuntimeError2('Empty script');
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const peekOp = () => (peek().type === 'op' ? peek().val : null);
  const next = () => toks[pos++];

  function parseExpr(minBp) {
    let left;
    const t = next();
    if (t.type === 'num') left = { k: 'lit', v: t.val };
    else if (t.type === 'str') left = { k: 'lit', v: t.val };
    else if (t.type === 'name') {
      const lower = t.val.toLowerCase();
      // Java parity: boolean literals are doubles (1.0 / 0.0) — scripts have no bool values
      if (lower === 'true') left = { k: 'lit', v: 1 };
      else if (lower === 'false') left = { k: 'lit', v: 0 };
      else left = { k: 'name', v: t.val };
    } else if (t.type === 'op') {
      if (t.val === '(') {
        left = parseExpr(0);
        if (peekOp() !== ')') throw RuntimeError2('Expected ) in script');
        next();
      } else if (UNARY.includes(t.val)) {
        left = { k: 'un', op: t.val, a: parseExpr(20) };
      } else throw RuntimeError2(`Unexpected token '${t.val}' in script`);
    } else throw RuntimeError2(`Unexpected end of script`);
    // postfix loop
    while (true) {
      const op = peekOp();
      if (op === '?' ) {
        if ((BP['?'] || 4) < minBp) break;
        next();
        const thenE = parseExpr(0);
        if (peekOp() !== ':') throw RuntimeError2("Expected ':' in ternary expression");
        next();
        const elseE = parseExpr(4);
        left = { k: 'if', a: left, b: thenE, c: elseE };
        continue;
      }
      if (op == null || !(op in BP)) break;
      const bp = BP[op];
      if (op === ':' && minBp > 0) break; // ternary else handled by caller
      if (bp < minBp) break;
      next();
      const right = ASSIGN_OPS.includes(op) ? parseExpr(bp - 1) : parseExpr(bp + 1);
      left = comparisonNode(op, left, right);
      if (ASSIGN_OPS.includes(op)) break;
      // chained comparisons, Python-style: 1<2<3 === (1<2) && (2<3); the middle operand's
      // VALUE is reused, not the boolean of the first comparison.
      if (COMPARISON_OPS.includes(op)) {
        while (COMPARISON_OPS.includes(peekOp())) {
          const op2 = next().val;
          const right2 = parseExpr(BP[op2] + 1);
          left = { k: 'cmpx', part: left, op: op2, b: right2 };
        }
      }
    }
    return left;
  }

  /* Comparison nodes keep their operands as-is ('cmp'), or wrap a comparison so chains can
 * reuse the middle operand's value ('cmpx'). */
function comparisonNode(op, a, b) {
  return COMPARISON_OPS.includes(op)
    ? { k: 'cmp', op, a, b }
    : { k: 'bin', op, a, b };
}

const stmts = [];
  while (peek().type !== 'eof') {
    stmts.push(parseExpr(0));
    if (peekOp() === ';') next();
    else if (peek().type !== 'eof') throw RuntimeError2(`Unexpected token '${peek().val ?? peek().type}' in script`);
  }
  if (!stmts.length) throw RuntimeError2('Empty script');
  return { statements: stmts };
}

/* ------------- Evaluation ------------- */
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
function toNumber(v, ctx) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const low = v.toLowerCase().trim();
    if (low === 'true') return 1;
    if (low === 'false') return 0;
    if (ctx.enums && ctx.enums[v] !== undefined) return ctx.enums[v];
    const n = Number(v.trim());
    if (!Number.isNaN(n) && v.trim() !== '') return n;
  }
  throw RuntimeError2(`The left operand of the operator [${ctx.op || '?'}] is not initialized`);
}
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  throw RuntimeError2('Value is not a boolean');
}
function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  let s = String(n);
  return s;
}
function doStringify(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return fmtNum(v);
  return String(v);
}
const EPS = Number.EPSILON; // Java Math.ulp(1.0) == 2^-52 == Number.EPSILON

function numEq(a, b) { return Math.abs(a - b) <= EPS; }

function compare(op, a, b) {
  const bothStr = typeof a === 'string' && typeof b === 'string';
  const numA = isNumber(a) || typeof a === 'boolean' || (typeof a === 'string' && strCanBeConverted(a, b));
  if (bothStr) {
    switch (op) {
      case '==': return a === b; case '!=': return a !== b;
      case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
    }
  }
  const na = toNumber(a, { op }), nb = toNumber(b, { op });
  switch (op) {
    case '==': return numEq(na, nb); case '!=': return !numEq(na, nb);
    case '<': return na < nb; case '>': return na > nb; case '<=': return na <= nb; case '>=': return na >= nb;
  }
  throw RuntimeError2(`Can't mix different types in a comparison`);
}
function strCanBeConverted(s) {
  if (ctxEnumsHas(s)) return true;
  const low = s.toLowerCase();
  if (low === 'true' || low === 'false') return true;
  return !Number.isNaN(Number(s.trim()));
}
let ctxEnumsHas = () => false;

/* The evaluation context: { getVar(name), setVar(name, value, create), enums } */
export function evalScript(ast, ctx) {
  const savedEnums = ctx.enums;
  ctxEnumsHas = (s) => savedEnums ? (s in savedEnums) : false;
  let result;
  for (const stmt of ast.statements) result = evalExpr(stmt, ctx);
  ctxEnumsHas = () => false;
  return result;
}

/** Evaluates a comparison or a comparison chain. Returns {val, res}: `val` is the value of the
 *  right-most operand (so deeper chain links can compare against it), `res` the boolean result. */
function compareValue(e, ctx) {
  if (e.k === 'cmp') {
    const a = evalExpr(e.a, ctx), b = evalExpr(e.b, ctx);
    return { val: b, res: compare(e.op, a, b) };
  }
  // 'cmpx'
  const inner = compareValue(e.part, ctx);
  if (!inner.res) return { val: undefined, res: false };
  const b = evalExpr(e.b, ctx);
  return { val: b, res: compare(e.op, inner.val, b) };
}
/* Java parity: comparisons evaluate to 1.0 (true) or 0.0 (false) — never a real boolean */
const asNum = (r) => (r ? 1 : 0);

function evalExpr(e, ctx) {
  switch (e.k) {
    case 'lit': return e.v;
    case 'cmp': return asNum(compareValue(e, ctx).res);
    case 'cmpx': return asNum(compareValue(e, ctx).res);
    case 'name': {
      let v;
      try { v = ctx.getVar(e.v); } catch { v = undefined; }
      if (v === undefined || v === null) {
        // bare enum names resolve to their registry value
        if (ctx.enums && ctx.enums[e.v] !== undefined) return ctx.enums[e.v];
        throw RuntimeError2(`Variable not found: ${e.v}`);
      }
      return v;
    }
    case 'un': {
      const v = evalExpr(e.a, ctx);
      if (e.op === '-') return -toNumber(v, { op: '-' });
      if (e.op === '!') return toBool(v) ? 0 : 1;
      // ~ bitwise complement on 64-bit value (range-checked like upstream)
      const n = toNumber(v, { op: '~' });
      if (n < -Math.pow(2, 63) || n >= Math.pow(2, 64)) throw RuntimeError2('~ operand out of range');
      return Number(~BigInt(Math.trunc(n)));
    }
    case 'if': {
      const c = evalExpr(e.a, ctx);
      return toBool(c) ? evalExpr(e.b, ctx) : evalExpr(e.c, ctx);
    }
    case 'bin': {
      const op = e.op;
      // Java parity (ExprBinary): BOTH operands are evaluated, and logic ops yield 1.0/0.0 doubles
      if (op === '&&') { const a = evalExpr(e.a, ctx); const b = evalExpr(e.b, ctx); return (toBool(a) && toBool(b)) ? 1 : 0; }
      if (op === '||') { const a = evalExpr(e.a, ctx); const b = evalExpr(e.b, ctx); return (toBool(a) || toBool(b)) ? 1 : 0; }
      if (ASSIGN_OPS.includes(op)) {
        if (e.a.k !== 'name') throw RuntimeError2('Assignment left operand must be a blackboard entry name');
        const name = e.a.v;
        const rhs = evalExpr(e.b, ctx);
        return assign(op, name, rhs, ctx, e.b);
      }
      if (['==','!=','<','>','<=','>='].includes(op)) {
        const a = evalExpr(e.a, ctx), b = evalExpr(e.b, ctx);
        return asNum(compare(op, a, b));
      }
      const a = evalExpr(e.a, ctx), b = evalExpr(e.b, ctx);
      if (op === '..') {
        return doStringify(a) + doStringify(b);
      }
      if (op === '+') {
        const bothStr = typeof a === 'string' && typeof b === 'string';
        if (bothStr) return a + b;
        const isStr = typeof a === 'string' || typeof b === 'string';
        if (isStr) {
          // upstream errors: mixed types in alpha add
          if (!(isNumable(a) && isNumable(b))) throw RuntimeError2(`Can't mix different types in an arithmetic expression`);
        }
        return toNumber(a, { op: '+' }) + toNumber(b, { op: '+' });
      }
      const na = toNumber(a, { op }), nb = toNumber(b, { op });
      switch (op) {
        case '-': return na - nb;
        case '*': return na * nb;
        case '/': return na / nb;
        case '&': return na & nb;
        case '|': return na | nb;
        case '^': return na ^ nb;
      }
      throw RuntimeError2(`Unknown operator ${op}`);
    }
  }
}

function isNumable(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  if (typeof v === 'string') return strCanBeConverted(v);
  return false;
}

/* Java parity: the TYPE a script-created entry gets on its first write.
 *  - every script number is a Java Double (ExprLiteral casts integers to double) → 'double'
 *  - enum bare names resolve through the registry (Map<String,Integer>) → 'int'
 *  - strings become ExprLiteral(String) → 'string' (locked, like any Java first write) */
function declaredTypeOf(rhsAst, value, ctx) {
  if (rhsAst && rhsAst.k === 'name' && ctx && ctx.enums && ctx.enums[rhsAst.v] !== undefined) return 'int';
  if (typeof value === 'number') return 'double';
  if (typeof value === 'string') return 'string';
  return 'any';
}

function assign(op, name, rhs, ctx, rhsAst) {
  const root = name.startsWith('@');
  const bare = root ? name.slice(1) : name;
  if (op === ':=') {
    ctx.setVar(bare, rhs, root, /*create*/ true, declaredTypeOf(rhsAst, rhs, ctx));
    return rhs;
  }
  if (op === '=') {
    const exists = ctx.hasVar(bare, root);
    if (!exists) throw RuntimeError2(`Blackboard entry [${bare}] is not initialized. Use the operator [:=] instead of [=]`);
    ctx.setVar(bare, rhs, root, false);
    return rhs;
  }
  // compound: numeric only (string += allowed)
  const cur = ctx.getVarAllowInit(bare, root);
  if (cur === undefined || cur === null) {
    throw RuntimeError2(`Blackboard entry [${bare}] is not initialized. Use [:=] first`);
  }
  let nv;
  if (op === '+=' && typeof cur === 'string') nv = cur + doStringify(rhs);
  else {
    const a = toNumber(cur, { op }), b = toNumber(rhs, { op });
    nv = op === '+=' ? a + b : op === '-=' ? a - b : op === '*=' ? a * b : a / b;
  }
  ctx.setVar(bare, nv, root, false);
  return nv;
}

/* ------------- Public: compile to a ScriptFunction ------------- */
export function parseScript(src) {
  const ast = parseScriptTree(src);
  return {
    src,
    evaluate(blackboard, enums) {
      const ctx = {
        enums: enums || {},
        getVar(name) { return lookup(blackboard, name); },
        getVarAllowInit(name) { return lookup(blackboard, name); },
        hasVar(name, root) {
          const bb = root ? blackboard.rootBlackboard() : blackboard;
          return findEntry(bb, name) !== null;
        },
        setVar(name, value, root, create, createType) {
          const bb = root ? blackboard.rootBlackboard() : blackboard;
          let e = findEntry(bb, name);
          if (e) { setEntry(bb, e, value); return; }
          if (create) { bb.createEntry(name, createType || 'any', value); }
          else throw RuntimeError2(`Variable not found: ${name}`);
        },
      };
      return evalScript(ast, ctx);
    },
  };
}

function findEntry(bb, name) {
  let b = bb;
  while (b) { const e = b.getEntry(name); if (e && e.value !== undefined) return e; else if (e) return null; b = b.parent; }
  return null;
}
function lookup(bb, name) {
  const e = findEntry(bb, name);
  return e ? e.value : undefined;
}
function setEntry(bb, e, value) {
  bb.apply(e, e.key, value);
}
