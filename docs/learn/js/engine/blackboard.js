// Faithful JS port of org.behaviortree.core.Blackboard (tree-chained, type-locked, stamped).
// Port value conversion semantics come from java/behaviortree-core Conversions / TypeInfo.
import { simClock } from './clock.js';
import { LogicError, RuntimeError2 } from './clock.js';

/* ---------------- String <-> value conversion (Conversions.java) ---------------- */
export const CONV = {
  string: { parse: (v) => String(v), toStr: (v) => String(v) },
  bool: { parse: (v) => parseBool(v) },
  int: { parse: (v) => parseIntStrict(v) },
  long: { parse: (v) => parseIntStrict(v) },
  double: { parse: (v) => parseDoubleStrict(v) },
  float: { parse: (v) => parseDoubleStrict(v) },
  any: { parse: (v) => inferLiteral(v) },
  status: { parse: (v) => parseStatus(v) },
};

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const t = String(v).trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw RuntimeError2(`Cannot convert "${v}" to boolean (expected 'true' or 'false')`);
}
function parseIntStrict(v) {
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isInteger(n)) throw RuntimeError2(`Cannot convert "${v}" to an integer`);
  return n;
}
function parseDoubleStrict(v) {
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (Number.isNaN(n)) throw RuntimeError2(`Cannot convert "${v}" to a double`);
  return n;
}
function parseStatus(v) {
  const t = String(v).trim().toUpperCase();
  if (['IDLE','RUNNING','SUCCESS','FAILURE','SKIPPED'].includes(t)) return t;
  throw RuntimeError2(`"${v}" is not a NodeStatus`);
}
export function inferLiteral(str) {
  // mirrors XmlTreeBuilder.inferLiteralValue: int-ish -> int, decimal -> double, else string
  if (typeof str !== 'string') return str;
  const t = str.trim();
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
    return Number(t);
  }
  if (/^-?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(t) && /[.e]/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return str;
}

// Numeric widening (NumericCast.java): a set stays legal when it is safe.
function isSafeSetType(destType, v) {
  if (destType === 'double' || destType === 'float') return typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string';
  if (destType === 'int' || destType === 'long') {
    if (typeof v === 'number') return Number.isInteger(v);
    return typeof v === 'boolean' || typeof v === 'string';
  }
  return false;
}

/* ---------------- Blackboard ---------------- */
export class Blackboard {
  constructor(parent = null, clockRef = simClock) {
    this.parent = parent;
    this.entries = new Map(); // key -> Entry
    this.seqCounter = 0;
    this.autoRemapping = false;
    this.remaps = new Map();  // subtree remapping: internal -> external
  }
  static create(parent = null) { return new Blackboard(parent); }
  rootBlackboard() { let b = this; while (b.parent) b = b.parent; return b; }
  addSubtreeRemapping(internalKey, externalKey) { this.remaps.set(internalKey, externalKey); }

  _bump(entry) { entry.seq = ++this.seqCounter; entry.stamp = simClock.ms; }

  /** getEntry: exact lookup on this blackboard only ('@' handled by caller) */
  getEntry(key) { return this.entries.get(key) || null; }

  _findEntry(key) {
    let b = this;
    while (b) { const e = b.entries.get(key); if (e) return { bb: b, e }; b = b.parent; }
    return null;
  }

  /** Reading: self entry, subtree remap, then parent only when _autoremap is enabled. */
  _resolveForRead(key) {
    const e = this.entries.get(key);
    if (e) return e;
    if (this.remaps.has(key) && this.parent) return this.parent._resolveForRead(this.remaps.get(key));
    if (this.autoRemapping && !key.startsWith('_') && this.parent) return this.parent._resolveForRead(key);
    return null;
  }

  /** Writing: self entry; subtree remaps redirect; autoRemap forwards to an existing parent
   *  entry; otherwise the entry is created locally (mirrors upstream Blackboard::set). */
  _resolveForWrite(key) {
    let e = this.entries.get(key);
    if (e) return { bb: this, e };
    if (this.remaps.has(key) && this.parent) return this.parent._resolveForWrite(this.remaps.get(key));
    if (this.autoRemapping && !key.startsWith('_') && this.parent) {
      let b = this.parent, pe = null, pb = null;
      while (b && !pe) { pe = b.entries.get(key); if (pe) pb = b; b = b.parent; }
      if (pe) return { bb: pb, e: pe };
    }
    e = { key, value: undefined, type: null, declared: false, locked: false, seq: 0, stamp: 0 };
    this.entries.set(key, e);
    this._bump(e);
    return { bb: this, e };
  }

  set(key, value) {
    if (key.startsWith('@')) { this.rootBlackboard().setRaw(key.slice(1), value); return; }
    const { e } = this._resolveForWrite(key);
    this.apply(e, key, value);
  }
  setRaw(key, value) {
    const { e } = this._resolveForWrite(key);
    this.apply(e, key, value);
  }
  apply(e, key, value) {
    if (e.value !== undefined && e.type && e.locked) {
      if (!compatible(e.type, value)) {
        throw LogicError(`Blackboard entry "${key}" was declared with type [${e.type}], but you are trying to write ${describeType(value)}. Once declared, the type of a port shall not change.`);
      }
    }
    if (e.type == null) {
      if (typeof value === 'number') e.type = Number.isInteger(value) ? 'int' : 'double';
      else if (typeof value === 'boolean') e.type = 'bool';
      else if (typeof value === 'string') e.type = 'string';
      else if (value && typeof value === 'object') e.type = 'any';
    }
    if (typeof value === 'string' && e.type != null && e.type !== 'string' && e.type !== 'any') {
      value = CONV[e.type]?.parse ? CONV[e.type].parse(value) : value;
    }
    e.value = value;
    this._bump(e);
  }

  typedGet(key, type) {
    if (key.startsWith('@')) return this.rootBlackboard().typedGet(key.slice(1), type);
    const e = this._resolveForRead(key);
    if (e === null || e.value === undefined) throw RuntimeError2(`Blackboard does not contain the key: [${key}]`);
    return convert(e.value, type, key);
  }
  get(key, type) { return this.typedGet(key, type); }
  tryGet(key, type) { try { return { present: true, value: this.typedGet(key, type) }; } catch { return { present: false }; } }

  /** Declares an entry with a fixed port type (TreeNodesModel / manifest-driven). */
  createEntry(key, portType, defaultValue) {
    if (key.startsWith('@')) { this.rootBlackboard().createEntry(key.slice(1), portType, defaultValue); return; }
    let e = this.entries.get(key);
    if (!e) {
      e = { key, value: undefined, type: portType, declared: true, locked: true, seq: 0, stamp: 0 };
      this.entries.set(key, e);
    } else if (!e.declared) { e.type = portType; e.declared = true; e.locked = true; }
    if (defaultValue !== undefined && e.value === undefined) {
      e.value = typeof defaultValue === 'string' && portType && portType !== 'string' && portType !== 'any'
        ? CONV[portType].parse(defaultValue) : defaultValue;
    }
    this._bump(e);
    return e;
  }

  unset(key) {
    if (key.startsWith('@')) { this.rootBlackboard().unset(key.slice(1)); return; }
    this.entries.delete(key);
  }
  keys() { return [...this.entries.keys()]; }
  anyEntries() { return [...this.entries.values()].filter((e) => e.value !== undefined); }
}

function compatible(type, v) {
  if (type === 'any' || type == null) return true;
  if (typeof v === 'number') return ['int','long','double','float','status'].includes(type) ? isSafeSetType(type, v) : false;
  if (typeof v === 'boolean') return type === 'bool' || ['int','double'].includes(type);
  if (typeof v === 'string') return true; // strings parse into typed entries
  if (type === 'any') return true;
  if (Array.isArray(v)) return true; // queues / arrays
  return false;
}

function convert(value, type, key) {
  if (type == null || type === 'any') { if (typeof value === 'boolean') return value; return value; }
  if (type === 'status') return parseStatus(value);
  if (type === 'string') {
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
    return String(value);
  }
  if (typeof value === 'number') {
    if ((type === 'int' || type === 'long') && !Number.isInteger(value)) throw RuntimeError2(`Cannot convert ${value} to int for key [${key}]`);
    return value;
  }
  if (typeof value === 'boolean') {
    if (['int'].includes(type)) return value ? 1 : 0;  // NumericCast allows bool -> int
    if (['double','float'].includes(type)) return value ? 1.0 : 0.0;
    if (type === 'bool') return value;
  }
  return CONV[type].parse(value);
}

function describeType(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? 'an integer' : 'a double';
  if (typeof v === 'boolean') return 'a boolean';
  if (typeof v === 'string') return 'a string';
  return 'another type';
}
