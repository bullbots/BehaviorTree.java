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

  /** Java Blackboard.getEntry parity: '@' escape, local entry, subtree remap → parent,
   *  then autoRemapping → parent. Returns null when nothing was found anywhere. */
  getEntry(key) {
    if (key.startsWith('@')) return this.rootBlackboard().getEntry(key.slice(1));
    const local = this.entries.get(key);
    if (local) return local;
    if (this.parent) {
      const remapped = this.remaps.get(key);
      if (remapped) return this.parent.getEntry(remapped);
      if (this.autoRemapping && !key.startsWith('_')) return this.parent.getEntry(key);
    }
    return null;
  }

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
   *  entry, and — mirroring upstream createEntryImpl — newly created entries are also created
   *  in the PARENT blackboard when autoRemapping is on. Otherwise the entry is created locally. */
  _resolveForWrite(key) {
    let e = this.entries.get(key);
    if (e) return { bb: this, e };
    if (this.remaps.has(key) && this.parent) return this.parent._resolveForWrite(this.remaps.get(key));
    if (this.autoRemapping && !key.startsWith('_') && this.parent) {
      return this.parent._resolveForWrite(key);
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
    // Java parity (Blackboard.set): entries are strongly typed from the first written value.
    //   - string values do NOT lock the type (Java's `new TypeInfo()` == ANY)
    //   - a Number into a numeric entry is accepted when NumericCast.isSafe(previousType, n)
    //   - String values are parsed into the declared type; failure → "type shall not change"
    if (e.locked && e.type && e.type !== 'any' && value !== undefined) {
      const prevT = e.type;
      const newT = typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'double')
        : typeof value === 'boolean' ? 'bool'
        : typeof value === 'string' ? 'string'
        : 'any';
      let parseFailed = false;
      if (typeof value === 'string' && prevT !== 'string') {
        try { value = CONV[prevT].parse(value); } catch { parseFailed = true; }
      }
      if (parseFailed) {
        throw LogicError(`Blackboard::set(${key}): once declared, the type of a port shall not change. Previously declared type [${prevT}], can't parse the given value as [${prevT}].`);
      } else if (newT !== prevT && !ASSIGNABLE(prevT, newT, value)) {
        throw LogicError(`Blackboard::set(${key}): once declared, the type of a port shall not change. Previously declared type [${prevT}], current type [${value === null || value === undefined ? 'null' : newT}]`);
      }
    }
    if (!e.locked) {
      // Java Blackboard.set adoption path: the entry locks to the runtime class of the value
      if (typeof value === 'number') e.type = Number.isInteger(value) ? 'int' : 'double';
      else if (typeof value === 'boolean') e.type = 'bool';
      else if (typeof value === 'string') e.type = 'string'; // Java: String.class locks too
      else if (value && typeof value === 'object') e.type = 'any';
      if (e.type && e.type !== 'any') e.locked = true;
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

  /** Declares an entry with a fixed port type — Java `createEntryImpl` parity:
   *  existing entry → type-compatibility check; subtree remap / autoRemap → delegation to the
   *  parent blackboard; otherwise created locally with the declared type. */
  createEntry(key, portType, defaultValue) {
    if (key.startsWith('@')) { this.rootBlackboard().createEntry(key.slice(1), portType, defaultValue); return; }
    let e = this.entries.get(key);
    if (e) {
      const prev = e.type;
      const strong = prev && prev !== 'any';
      const declaring = portType && portType !== 'any';
      if (strong && declaring && prev !== portType) {
        throw LogicError(`Blackboard entry [${key}]: once declared, the type of a port shall not change. Previously declared type [${prev}], current type [${portType}]`);
      }
      if (!e.declared && portType) { e.type = portType; e.declared = true; if (portType !== 'any') e.locked = true; }
      if (defaultValue !== undefined && e.value === undefined) {
        e.value = typeof defaultValue === 'string' && portType && portType !== 'string' && portType !== 'any'
          ? CONV[portType].parse(defaultValue) : defaultValue;
      }
      this._bump(e);
      return e;
    }
    if (this.remaps.has(key) && this.parent) return this.parent.createEntry(this.remaps.get(key), portType, defaultValue);
    if (this.autoRemapping && !key.startsWith('_') && this.parent) return this.parent.createEntry(key, portType, defaultValue);
    e = { key, value: undefined, type: portType, declared: true, locked: portType !== 'any', seq: 0, stamp: 0 };
    this.entries.set(key, e);
    if (defaultValue !== undefined) {
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

/** Java parity for "can I overwrite this strongly-typed entry?": subclassing collapsed to our
 *  small type set plus NumericCast.isSafe for numbers. */
function ASSIGNABLE(prevT, newT, value) {
  if (prevT === newT) return true;
  if (prevT === 'any') return true;
  const numT = (v) => ['int','long','double','float'].includes(v);
  if (numT(prevT) && typeof value === 'number') {
    if (['int','long'].includes(prevT)) return value === Math.floor(value); // NumericCast.isSafe(int, n)
    return true; // double/float accepts any finite number
  }
  return false;
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
