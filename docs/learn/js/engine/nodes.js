// Faithful JS port of the node machinery: TreeNode/executeTick semantics (pre/post conditions,
// exception wrapping), Control/Decorator/Action nodes, and every built-in node from
// java/behaviortree-core. Poll-based Timeout/Delay/Sleep use the virtual clock.
import { STATUS, isCompleted, isActive, LogicError, RuntimeError2, BTError, simClock } from './clock.js';
import { parseScript } from './script.js';

export { STATUS, isCompleted, isActive, LogicError, RuntimeError2, simClock, BTError };

/* ---------------- Port helpers ---------------- */
export function manifestInput(name, type, def, desc) {
  return { dir: 'input', type, name, default: def ?? undefined, desc: desc || '' };
}
export function manifestOutput(name, type, desc) {
  return { dir: 'output', type, name, default: undefined, desc: desc || '' };
}
export function manifestInout(name, type, desc) {
  return { dir: 'inout', type, name, default: undefined, desc: desc || '' };
}

export function isBlackboardPointer(str) {
  if (typeof str !== 'string') return false;
  const t = str.trim();
  return t.length >= 3 && t[0] === '{' && t[t.length - 1] === '}';
}
export function stripBlackboardPointer(str) { return str.trim().slice(1, -1); }

/* ---------------- Base node ---------------- */
let uidCounter = 1;

export class TreeNode {
  constructor(name, registrationName, cfg) {
    this.nodeUid = uidCounter++;
    this.nodeName = name;
    this.registrationName = registrationName;
    this.config = cfg || this.blankConfig();
    if (this.config.inputPorts === null || this.config.inputPorts === undefined) this.config.inputPorts = {};
    if (this.config.outputPorts === null || this.config.outputPorts === undefined) this.config.outputPorts = {};
    this.config.otherAttributes ??= {};
    this.config.enums ??= {};
    this.config.path ??= name;
    this._status = STATUS.IDLE;
    this.preScripts = {};
    this.postScripts = {};
    this.lastReturn = undefined;
  }
  blankConfig() { return { inputPorts: {}, outputPorts: {}, otherAttributes: {}, enums: {} }; }

  name() { return this.nodeName; }
  status() { return this._status; }
  resetStatus() { this._status = STATUS.IDLE; }
  fullPath() { return this.config.path; }

  manifestPorts() { return this.constructor.manifest || {}; }

  /* ---- port access (mirrors TreeNode.getInput / setOutput) ---- */
  getInput(key, type) {
    let raw = this.config.inputPorts[key];
    if (raw === undefined) {
      const info = this.manifestPorts()[key];
      if (!info) throw RuntimeError2(`getInput() of node '${this.fullPath()}' failed because the manifest doesn't contain the key: [${key}]`);
      if (info.default === undefined) throw RuntimeError2(`getInput() of node '${this.fullPath()}' failed because neither the manifest nor the XML contain the key: [${key}]`);
      raw = info.default;
    }
    if (isBlackboardPointer(raw) || raw === '=' || raw === '{=}') {
      const bb = this.config.blackboard;
      if (!bb) throw RuntimeError2("getInput(): trying to access an invalid Blackboard");
      const key2 = raw === '=' || raw === '{=}' ? key : stripBlackboardPointer(raw);
      const r = bb.tryGet(key2, type || 'any');
      if (!r.present) throw RuntimeError2(`getInput() failed because it was unable to find the key [${key}] remapped to [${key2}]`);
      return r.value;
    }
    return parseLiteral(raw, type, this.config.enums);
  }

  tryGetInput(key, type) {
    try { return { present: true, value: this.getInput(key, type) }; }
    catch (e) { return { present: false }; }
  }

  setOutput(key, value) {
    const remap = this.config.outputPorts[key];
    if (remap === undefined) throw RuntimeError2(`setOutput() failed: NodeConfig.outputPorts does not contain the key: [${key}]`);
    const bb = this.config.blackboard;
    if (!bb) throw RuntimeError2('setOutput() failed: trying to access a Blackboard, but the Blackboard is null');
    if (remap === '=' || remap === '{=}') { bb.set(key, value); return; }
    if (!isBlackboardPointer(remap)) throw RuntimeError2('setOutput requires a blackboard pointer. Use {}');
    bb.set(stripBlackboardPointer(remap), value);
  }

  /* ---- pre/post-condition script hooks ---- */
  setPreConditionScript(attr, fn) { this.preScripts[attr] = fn; }
  setPostConditionScript(attr, fn) { this.postScripts[attr] = fn; }
  attachConditionScripts() {
    for (const [attr, fn] of Object.entries(this.config.preFns || {})) this.setPreConditionScript(attr, fn);
    for (const [attr, fn] of Object.entries(this.config.postFns || {})) this.setPostConditionScript(attr, fn);
  }

  checkPreConditions() {
    const order = ['_failureIf', '_successIf', '_skipIf', '_while'];
    for (const cond of order) {
      const fn = this.preScripts[cond];
      if (!fn) continue;
      const result = truthy(fn.evaluate(this.config.blackboard, this.config.enums));
      if (this._status === STATUS.IDLE || this._status === STATUS.SKIPPED) {
        if (result) {
          if (cond === '_failureIf') return STATUS.FAILURE;
          if (cond === '_successIf') return STATUS.SUCCESS;
          if (cond === '_skipIf') return STATUS.SKIPPED;
        } else if (cond === '_while') return STATUS.SKIPPED;
      } else if (this._status === STATUS.RUNNING && cond === '_while' && !result) {
        this.haltNode();
        return STATUS.SKIPPED;
      }
    }
    return null;
  }
  checkPostConditions(s) {
    if (s === STATUS.SUCCESS) this.runPost('_onSuccess');
    else if (s === STATUS.FAILURE) this.runPost('_onFailure');
    this.runPost('_post');
  }
  runPost(attr) {
    const fn = this.postScripts[attr];
    if (fn) fn.evaluate(this.config.blackboard, this.config.enums);
  }

  haltNode() { this.halt(); const f = this.postScripts['_onHalted']; if (f) f.evaluate(this.config.blackboard, this.config.enums); }
  isHalted() { return this._status === STATUS.IDLE; }

  executeTick() {
    let newStatus;
    try {
      const precond = this.checkPreConditions();
      if (precond) newStatus = precond;
      else { this.ticksCount = (this.ticksCount || 0) + 1; newStatus = this.tick(); }
    } catch (e) {
      throw wrapExec(e, this);
    }
    if (isCompleted(newStatus)) this.checkPostConditions(newStatus);
    if (newStatus !== STATUS.SKIPPED) this.setStatus(newStatus);
    this.lastReturn = newStatus;
    return this.lastReturn;
  }

  setStatus(newStatus) {
    if (newStatus === STATUS.IDLE) throw RuntimeError2(`Node [${this.nodeName}]: you are not allowed to set manually the status to IDLE. Use resetStatus() instead.`);
    if (!validStatus(newStatus)) throw RuntimeError2(`Node [${this.nodeName}]: invalid status ${newStatus}`);
    this._status = newStatus;
  }

  tick() { throw new Error('abstract'); }
  halt() { this.resetStatus(); }
  type() { return 'ACTION'; }
}
function validStatus(s) { return ['IDLE','RUNNING','SUCCESS','FAILURE','SKIPPED'].includes(s); }

export class NodeExecutionError extends BTError {
  constructor(node, cause) {
    super(`Node [${node.nodeName}]: ${cause._msg || cause.message}`, 'NodeExecutionError');
    this.nodePath = node.fullPath();
    this.registrationName = node.registrationName;
    this.rootCause = cause.rootCause || cause.message;
    this.cause = cause;
  }
}
function wrapExec(e, node) {
  if (e instanceof NodeExecutionError) return e;
  const n = new NodeExecutionError(node, e);
  return n;
}

export class ControlNode extends TreeNode {
  constructor(name, registrationName, cfg) {
    super(name, registrationName, cfg);
    this.children = [];
  }
  type() { return 'CONTROL'; }
  addChild(c) { this.children.push(c); c.config.path = `${this.config.path}/${c.nodeName}`; }
  child(i) { return this.children[i]; }
  childrenCount() { return this.children.length; }
  halt() {
    for (const c of this.children) haltChild(c);
    this.resetStatus();
  }
}
export function haltChild(c) {
  if (c.status() === STATUS.RUNNING) c.haltNode();
  c.resetStatus();
}

export class DecoratorNode extends TreeNode {
  constructor(name, registrationName, cfg) {
    super(name, registrationName, cfg);
    this.childNode = null;
  }
  type() { return 'DECORATOR'; }
  setChild(c) {
    if (this.childNode) throw new BTError(`Decorator [${this.nodeName}] already has a child assigned`);
    this.childNode = c;
    c.config.path = `${this.config.path}/${c.nodeName}`;
    c.config.blackboard ??= this.config.blackboard;
  }
  resetChild() {
    if (!this.childNode) return;
    haltChild(this.childNode);
  }
  halt() { this.resetChild(); this.resetStatus(); }
  executeTick() {
    const s = super.executeTick();
    if (this.childNode && isCompleted(this.childNode.status())) this.childNode.resetStatus();
    return s;
  }
}

export class ConditionNode extends TreeNode {
  type() { return 'CONDITION'; }
  halt() { this.resetStatus(); }
}

export class ActionNodeBase extends TreeNode {
  type() { return 'ACTION'; }
}

export class SyncActionNode extends ActionNodeBase {
  tick() {
    const s = this.doTick();
    if (s === STATUS.RUNNING) throw LogicError(`[${this.nodeName}]: Tick() of a SyncActionNode must not return RUNNING`);
    return s;
  }
  doTick() { throw new Error('abstract'); }
}

export class StatefulActionNode extends ActionNodeBase {
  tick() {
    const prev = this.status();
    if (prev === STATUS.IDLE) {
      const s = this.onStart();
      if (s === STATUS.IDLE) throw LogicError(`${this.nodeName}: onStart() must not return IDLE`);
      return s;
    }
    if (prev === STATUS.RUNNING) {
      const s = this.onRunning();
      if (s === STATUS.IDLE) throw LogicError(`${this.nodeName}: onRunning() must not return IDLE`);
      return s;
    }
    return prev;
  }
  halt() {
    if (this.status() === STATUS.RUNNING) this.onHalted();
    this.resetStatus();
  }
  onStart() { throw new Error('abstract'); }
  onRunning() { throw new Error('abstract'); }
  onHalted() {}
}

export function truthy(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return false;
}

/* =================== BUILT-IN NODES =================== */

/* ----- controls ----- */
export class SequenceNode extends ControlNode {
  constructor(name, cfg, makeAsync = false) {
    super(name, makeAsync ? 'AsyncSequence' : 'Sequence', cfg);
    this.currentChildIdx = 0;
    this.skippedCount = 0;
    this.makeAsync = makeAsync;
  }
  static manifest = {};
  tick() {
    const n = this.children.length;
    if (!isActive(this.status())) this.skippedCount = 0;
    this.setStatus(STATUS.RUNNING);
    while (this.currentChildIdx < n) {
      const child = this.children[this.currentChildIdx];
      const prevStatus = child.status();
      const s = child.executeTick();
      switch (s) {
        case STATUS.RUNNING: return STATUS.RUNNING;
        case STATUS.FAILURE: this.resetChildren(); this.currentChildIdx = 0; return s;
        case STATUS.SUCCESS:
          this.currentChildIdx++;
          if (this.makeAsync && prevStatus === STATUS.IDLE && this.currentChildIdx < n) return STATUS.RUNNING;
          break;
        case STATUS.SKIPPED: this.currentChildIdx++; this.skippedCount++; break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    const allSkipped = this.skippedCount === n;
    if (this.currentChildIdx === n) { this.resetChildren(); this.currentChildIdx = 0; this.skippedCount = 0; }
    return allSkipped ? STATUS.SKIPPED : STATUS.SUCCESS;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class SequenceWithMemoryNode extends ControlNode {
  constructor(name, cfg) { super(name, 'SequenceWithMemory', cfg); this.currentChildIdx = 0; this.skippedCount = 0; }
  static manifest = {};
  // Deliberately NOT resetting currentChildIdx on halt (mirrors upstream + the Java port).
  tick() {
    const n = this.children.length;
    if (!isActive(this.status())) this.skippedCount = 0;
    this.setStatus(STATUS.RUNNING);
    while (this.currentChildIdx < n) {
      const child = this.children[this.currentChildIdx];
      const s = child.executeTick();
      switch (s) {
        case STATUS.RUNNING: return STATUS.RUNNING;
        case STATUS.FAILURE: this.haltChildren(this.currentChildIdx); return s;
        case STATUS.SUCCESS: this.currentChildIdx++; break;
        case STATUS.SKIPPED: this.currentChildIdx++; this.skippedCount++; break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    const allSkipped = this.skippedCount === n;
    if (this.currentChildIdx === n) { this.resetChildren(); this.currentChildIdx = 0; this.skippedCount = 0; }
    return allSkipped ? STATUS.SKIPPED : STATUS.SUCCESS;
  }
  haltChildren(from) { for (let i = from; i < this.children.length; i++) haltChild(this.children[i]); }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class FallbackNode extends ControlNode {
  constructor(name, cfg, makeAsync = false) {
    super(name, makeAsync ? 'AsyncFallback' : 'Fallback', cfg);
    this.currentChildIdx = 0; this.skippedCount = 0; this.makeAsync = makeAsync;
  }
  static manifest = {};
  tick() {
    const n = this.children.length;
    if (!isActive(this.status())) this.skippedCount = 0;
    this.setStatus(STATUS.RUNNING);
    while (this.currentChildIdx < n) {
      const child = this.children[this.currentChildIdx];
      const s = child.executeTick();
      switch (s) {
        case STATUS.RUNNING: return s;
        case STATUS.SUCCESS: this.resetChildren(); this.currentChildIdx = 0; return s;
        case STATUS.FAILURE:
          this.currentChildIdx++;
          if (this.makeAsync && this.currentChildIdx < n) return STATUS.RUNNING;
          break;
        case STATUS.SKIPPED: this.currentChildIdx++; this.skippedCount++; break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    const allSkipped = this.skippedCount === n;
    if (this.currentChildIdx === n) { this.resetChildren(); this.currentChildIdx = 0; this.skippedCount = 0; }
    return allSkipped ? STATUS.SKIPPED : STATUS.FAILURE;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class ReactiveSequence extends ControlNode {
  constructor(name, cfg) { super(name, 'ReactiveSequence', cfg); this.runningChild = -1; }
  static manifest = {};
  tick() {
    let allSkipped = true;
    if (this.status() === STATUS.IDLE) this.runningChild = -1;
    this.setStatus(STATUS.RUNNING);
    for (let index = 0; index < this.childrenCount(); index++) {
      const s = this.children[index].executeTick();
      allSkipped = allSkipped && (s === STATUS.SKIPPED);
      switch (s) {
        case STATUS.RUNNING: {
          for (let i = 0; i < this.childrenCount(); i++) if (i !== index) haltChild(this.children[i]);
          this.runningChild = index;
          return STATUS.RUNNING;
        }
        case STATUS.FAILURE: this.resetChildren(); return STATUS.FAILURE;
        case STATUS.SUCCESS: break;
        case STATUS.SKIPPED: haltChild(this.children[index]); break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    this.resetChildren();
    return allSkipped ? STATUS.SKIPPED : STATUS.SUCCESS;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class ReactiveFallback extends ControlNode {
  constructor(name, cfg) { super(name, 'ReactiveFallback', cfg); this.runningChild = -1; }
  static manifest = {};
  tick() {
    let allSkipped = true;
    if (this.status() === STATUS.IDLE) this.runningChild = -1;
    this.setStatus(STATUS.RUNNING);
    for (let index = 0; index < this.childrenCount(); index++) {
      const s = this.children[index].executeTick();
      allSkipped = allSkipped && (s === STATUS.SKIPPED);
      switch (s) {
        case STATUS.RUNNING: {
          for (let i = 0; i < this.childrenCount(); i++) if (i !== index) haltChild(this.children[i]);
          this.runningChild = index;
          return STATUS.RUNNING;
        }
        case STATUS.FAILURE: break;
        case STATUS.SUCCESS: this.resetChildren(); return STATUS.SUCCESS;
        case STATUS.SKIPPED: haltChild(this.children[index]); break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    this.resetChildren();
    return allSkipped ? STATUS.SKIPPED : STATUS.FAILURE;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class ParallelNode extends ControlNode {
  constructor(name, cfg) {
    super(name, 'Parallel', cfg);
    this.successThreshold = -1; this.failureThreshold = 1;
    this.completed = new Set(); this.successCount = 0; this.failureCount = 0;
  }
  static manifest = {
    success_count: manifestInput('success_count', 'int', '-1', 'number of children that need to succeed to trigger a SUCCESS (negative = from the end)'),
    failure_count: manifestInput('failure_count', 'int', '1', 'number of children that need to fail to trigger a FAILURE (negative = from the end)'),
  };
  _successThreshold() { return this.successThreshold < 0 ? Math.max(this.children.length + this.successThreshold + 1, 0) : this.successThreshold; }
  _failureThreshold() { return this.failureThreshold < 0 ? Math.max(this.children.length + this.failureThreshold + 1, 0) : this.failureThreshold; }
  _clear() { this.completed.clear(); this.successCount = 0; this.failureCount = 0; }
  halt() { this._clear(); for (const c of this.children) haltChild(c); this.resetStatus(); }
  tick() {
    this.successThreshold = this.getInput('success_count', 'int');
    this.failureThreshold = this.getInput('failure_count', 'int');
    const n = this.children.length;
    if (n < this._successThreshold()) throw LogicError('Number of children is less than threshold. Can never succeed.');
    if (n < this._failureThreshold()) throw LogicError('Number of children is less than threshold. Can never fail.');
    this.setStatus(STATUS.RUNNING);
    let skippedCount = 0;
    for (let i = 0; i < n; i++) {
      if (!this.completed.has(i)) {
        const s = this.children[i].executeTick();
        switch (s) {
          case STATUS.SKIPPED: skippedCount++; break;
          case STATUS.SUCCESS: this.completed.add(i); this.successCount++; break;
          case STATUS.FAILURE: this.completed.add(i); this.failureCount++; break;
          case STATUS.RUNNING: break;
          case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
        }
      }
      const required = this._successThreshold();
      if (this.successCount >= required || (this.successThreshold < 0 && (this.successCount + skippedCount) >= required)) {
        this._clear(); this.resetChildren(); return STATUS.SUCCESS;
      }
      if (((n - this.failureCount) < required) || (this.failureCount === this._failureThreshold())) {
        this._clear(); this.resetChildren(); return STATUS.FAILURE;
      }
    }
    return skippedCount === n ? STATUS.SKIPPED : STATUS.RUNNING;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class ParallelAllNode extends ControlNode {
  constructor(name, cfg) { super(name, 'ParallelAll', cfg); this.completed = new Set(); this.failureCount = 0; }
  static manifest = { max_failures: manifestInput('max_failures', 'int', '1', 'number of failures needed to consider the whole node as failed') };
  halt() { this.completed.clear(); this.failureCount = 0; for (const c of this.children) haltChild(c); this.resetStatus(); }
  tick() {
    const maxFailures = this.getInput('max_failures', 'int');
    this.failureThreshold = maxFailures < 0 ? Math.max(this.children.length + maxFailures + 1, 0) : maxFailures;
    const n = this.children.length;
    if (n < this.failureThreshold) throw LogicError('Number of children is less than threshold. Can never fail.');
    this.setStatus(STATUS.RUNNING);
    let skippedCount = 0;
    for (let index = 0; index < n; index++) {
      if (this.completed.has(index)) continue;
      const s = this.children[index].executeTick();
      switch (s) {
        case STATUS.SUCCESS: this.completed.add(index); break;
        case STATUS.FAILURE: this.completed.add(index); this.failureCount++; break;
        case STATUS.RUNNING: break;
        case STATUS.SKIPPED: skippedCount++; break;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    if (skippedCount === n) return STATUS.SKIPPED;
    if (skippedCount + this.completed.size >= n) {
      this.resetChildren();
      this.completed.clear();
      const result = this.failureCount >= this.failureThreshold ? STATUS.FAILURE : STATUS.SUCCESS;
      this.failureCount = 0;
      return result;
    }
    return STATUS.RUNNING;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class SwitchNode extends ControlNode {
  constructor(name, cfg, numCases) {
    super(name, `Switch${numCases}`, cfg);
    this.numCases = numCases;
    this.caseKeys = Array.from({ length: numCases }, (_, i) => `case_${i + 1}`);
    this.runningChild = -1;
  }
  static manifestFor(numCases) {
    const m = { variable: manifestInput('variable', 'string', undefined, 'The variable to compare against the case values') };
    for (let i = 1; i <= numCases; i++) m[`case_${i}`] = manifestInput(`case_${i}`, 'string', undefined, 'Value to compare against');
    return m;
  }
  manifestPorts() { return SwitchNode.manifestFor(this.numCases); }
  tick() {
    if (this.childrenCount() !== this.numCases + 1) throw LogicError('Wrong number of children in Switch; must be (num_cases + default)');
    const variable = this.tryGetInput('variable', 'string');
    let matchIndex = this.numCases;
    if (variable.present) {
      for (let index = 0; index < this.numCases; index++) {
        const value = this.tryGetInput(this.caseKeys[index], 'string');
        if (value.present && checkStringEquality(variable.value, value.value, this.config.enums)) { matchIndex = index; break; }
      }
    }
    if (this.runningChild !== -1 && this.runningChild !== matchIndex) haltChild(this.children[this.runningChild]);
    const ret = this.children[matchIndex].executeTick();
    if (ret === STATUS.SKIPPED) { this.runningChild = -1; return STATUS.SKIPPED; }
    if (ret === STATUS.RUNNING) { this.runningChild = matchIndex; }
    else { this.resetChildren(); this.runningChild = -1; }
    return ret;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}
function checkStringEquality(v1, v2, enums) {
  if (v1 === v2) return true;
  const i1 = toIntCmp(v1, enums), i2 = toIntCmp(v2, enums);
  if (i1 !== null && i2 !== null && i1 === i2) return true;
  const r1 = toRealCmp(v1, enums), r2 = toRealCmp(v2, enums);
  const eps = Math.ulp(1.0);
  return r1 !== null && r2 !== null && Math.abs(r1 - r2) <= eps;
}
function toIntCmp(str, enums) {
  if (enums && str in enums) return enums[str];
  if (/^-?\d+$/.test(str.trim())) return parseInt(str, 10);
  return null;
}
function toRealCmp(str, enums) {
  if (enums && str in enums) return Number(enums[str]);
  const n = Number(str.trim());
  return Number.isNaN(n) ? null : n;
}

export class IfThenElseNode extends ControlNode {
  constructor(name, cfg) { super(name, 'IfThenElse', cfg); this.childIdx = 0; }
  static manifest = {};
  halt() { this.childIdx = 0; for (const c of this.children) haltChild(c); this.resetStatus(); }
  tick() {
    const n = this.childrenCount();
    if (n !== 2 && n !== 3) throw LogicError('IfThenElse must have either 2 or 3 children');
    this.setStatus(STATUS.RUNNING);
    if (this.childIdx === 0) {
      const conditionStatus = this.children[0].executeTick();
      if (conditionStatus === STATUS.RUNNING) return conditionStatus;
      if (conditionStatus === STATUS.SUCCESS) this.childIdx = 1;
      else if (conditionStatus === STATUS.FAILURE) {
        if (n === 3) this.childIdx = 2;
        else return conditionStatus;
      }
    }
    if (this.childIdx > 0) {
      const s = this.children[this.childIdx].executeTick();
      if (s === STATUS.RUNNING) return STATUS.RUNNING;
      this.resetChildren();
      this.childIdx = 0;
      return s;
    }
    throw LogicError('Something unexpected happened in IfThenElse');
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

export class WhileDoElseNode extends ControlNode {
  constructor(name, cfg) { super(name, 'WhileDoElse', cfg); }
  static manifest = {};
  tick() {
    const n = this.childrenCount();
    if (n !== 2 && n !== 3) throw LogicError('WhileDoElse must have either 2 or 3 children');
    this.setStatus(STATUS.RUNNING);
    const conditionStatus = this.children[0].executeTick();
    if (conditionStatus === STATUS.RUNNING) return conditionStatus;
    let status = STATUS.IDLE;
    if (conditionStatus === STATUS.SUCCESS) {
      if (n === 3) haltChild(this.children[2]);
      status = this.children[1].executeTick();
    } else if (conditionStatus === STATUS.FAILURE) {
      if (n === 3) { haltChild(this.children[1]); status = this.children[2].executeTick(); }
      else status = STATUS.FAILURE;
    }
    if (status === STATUS.RUNNING) return STATUS.RUNNING;
    this.resetChildren();
    return status;
  }
  resetChildren() { for (const c of this.children) haltChild(c); }
}

/* ----- decorators ----- */
export class InverterNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'Inverter', cfg); }
  static manifest = {};
  tick() {
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (s === STATUS.SUCCESS) { this.resetChild(); return STATUS.FAILURE; }
    if (s === STATUS.FAILURE) { this.resetChild(); return STATUS.SUCCESS; }
    return s;
  }
}

export class ForceSuccessNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'ForceSuccess', cfg); }
  static manifest = {};
  tick() {
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.resetChild(); return STATUS.SUCCESS; }
    return s;
  }
}
export class ForceFailureNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'ForceFailure', cfg); }
  static manifest = {};
  tick() {
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.resetChild(); return STATUS.FAILURE; }
    return s;
  }
}

export class RetryNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'RetryUntilSuccessful', cfg); this.maxAttempts = 0; this.tryCount = 0; }
  static manifest = { num_attempts: manifestInput('num_attempts', 'int', undefined, 'Execute again a failing child up to N times. Use -1 to create an infinite loop.') };
  halt() { this.tryCount = 0; this.resetChild(); this.resetStatus(); }
  tick() {
    try { this.maxAttempts = this.getInput('num_attempts', 'int'); }
    catch (e) { throw RuntimeError2(`Missing parameter [num_attempts] in Retry`); }
    let doLoop = this.tryCount < this.maxAttempts || this.maxAttempts === -1;
    this.setStatus(STATUS.RUNNING);
    while (doLoop) {
      const s = this.childNode.executeTick();
      switch (s) {
        case STATUS.SUCCESS: this.tryCount = 0; this.resetChild(); return STATUS.SUCCESS;
        case STATUS.FAILURE: {
          this.tryCount++;
          this.maxAttempts = this.getInput('num_attempts', 'int');
          doLoop = this.tryCount < this.maxAttempts || this.maxAttempts === -1;
          this.resetChild();
          break;
        }
        case STATUS.RUNNING: return STATUS.RUNNING;
        case STATUS.SKIPPED: this.resetChild(); return STATUS.SKIPPED;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    this.tryCount = 0;
    return STATUS.FAILURE;
  }
}

export class RepeatNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'Repeat', cfg); this.numCycles = 0; this.repeatCount = 0; }
  static manifest = { num_cycles: manifestInput('num_cycles', 'int', undefined, 'Repeat a successful child up to N times. Use -1 to create an infinite loop.') };
  halt() { this.repeatCount = 0; this.resetChild(); this.resetStatus(); }
  tick() {
    try { this.numCycles = this.getInput('num_cycles', 'int'); }
    catch (e) { throw RuntimeError2(`Missing parameter [num_cycles] in Repeat`); }
    let doLoop = this.repeatCount < this.numCycles || this.numCycles === -1;
    this.setStatus(STATUS.RUNNING);
    while (doLoop) {
      const s = this.childNode.executeTick();
      switch (s) {
        case STATUS.SUCCESS: {
          this.repeatCount++;
          this.numCycles = this.getInput('num_cycles', 'int');
          doLoop = this.repeatCount < this.numCycles || this.numCycles === -1;
          this.resetChild();
          break;
        }
        case STATUS.FAILURE: this.repeatCount = 0; this.resetChild(); return STATUS.FAILURE;
        case STATUS.RUNNING: return STATUS.RUNNING;
        case STATUS.SKIPPED: this.resetChild(); return STATUS.SKIPPED;
        case STATUS.IDLE: throw LogicError(`[${this.nodeName}]: A child should not return IDLE`);
      }
    }
    this.repeatCount = 0;
    return STATUS.SUCCESS;
  }
}

export class TimeoutNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'Timeout', cfg); this.started = false; this.deadlineNanos = 0n; }
  static manifest = { msec: manifestInput('msec', 'int', undefined, 'Halt the child if it is still running after msec milliseconds. 0 means no timeout.') };
  halt() { this.started = false; this.resetChild(); this.resetStatus(); }
  tick() {
    if (!this.started) {
      this.started = true;
      this.setStatus(STATUS.RUNNING);
      const msec = this.getInput('msec', 'int');
      this.deadlineNanos = msec > 0 ? simClock.now() + BigInt(msec) * 1_000_000n : 0n;
    }
    if (this.deadlineNanos !== 0n && simClock.now() >= this.deadlineNanos) {
      this.started = false;
      this.resetChild();
      return STATUS.FAILURE;
    }
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.started = false; this.resetChild(); }
    return s;
  }
}

export class DelayNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'Delay', cfg); this.started = false; this.deadlineNanos = 0n; }
  static manifest = { delay_msec: manifestInput('delay_msec', 'int', undefined, 'Tick the child after this many ms') };
  halt() { this.started = false; this.resetChild(); this.resetStatus(); }
  tick() {
    if (!this.started) {
      this.started = true;
      this.setStatus(STATUS.RUNNING);
      const msec = this.getInput('delay_msec', 'int');
      this.deadlineNanos = simClock.now() + BigInt(msec) * 1_000_000n;
    }
    if (simClock.now() < this.deadlineNanos) return STATUS.RUNNING;
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.started = false; this.resetChild(); }
    return s;
  }
}

export class RunOnceNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'RunOnce', cfg); this.alreadyTicked = false; this.returnedStatus = STATUS.IDLE; }
  static manifest = { then_skip: manifestInput('then_skip', 'bool', 'true', 'If true, skip after the first execution, otherwise return the same NodeStatus returned once by the child.') };
  tick() {
    const skipOpt = this.tryGetInput('then_skip', 'bool');
    const skip = skipOpt.present ? skipOpt.value : true;
    if (this.alreadyTicked) return skip ? STATUS.SKIPPED : this.returnedStatus;
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.alreadyTicked = true; this.returnedStatus = s; this.resetChild(); }
    return s;
  }
}

export class KeepRunningUntilFailureNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'KeepRunningUntilFailure', cfg); }
  static manifest = {};
  tick() {
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (s === STATUS.FAILURE) { this.resetChild(); return STATUS.FAILURE; }
    if (s === STATUS.SUCCESS) { this.resetChild(); return STATUS.RUNNING; }
    return s;
  }
}

export class PreconditionNode extends DecoratorNode {
  constructor(name, cfg) {
    super(name, 'Precondition', cfg);
    this.script = '';
    this.executor = null;
    this.childrenRunning = false;
  }
  static manifest = {
    if: manifestInput('if', 'any', undefined, 'Must return false or true'),
    else: manifestInput('else', 'status', 'FAILURE', 'Return status if condition is false'),
  };
  loadExecutor() {
    const code = this.getInput('if', 'any');
    if (typeof code !== 'string') throw RuntimeError2('Precondition [if] port must be a script string');
    if (code === this.script && this.executor) return;
    this.executor = parseScript(code);
    this.script = code;
  }
  halt() { this.childrenRunning = false; this.resetChild(); this.resetStatus(); }
  tick() {
    this.loadExecutor();
    const elseOpt = this.tryGetInput('else', 'status');
    const elseReturn = elseOpt.present ? elseOpt.value : STATUS.FAILURE;
    if (!this.childrenRunning) {
      const v = this.executor.evaluate(this.config.blackboard, this.config.enums);
      this.childrenRunning = truthy(v);
    }
    if (!this.childrenRunning) return elseReturn;
    const s = this.childNode.executeTick();
    if (isCompleted(s)) { this.resetChild(); this.childrenRunning = false; }
    return s;
  }
}

export class LoopNode extends DecoratorNode {
  constructor(name, cfg) {
    super(name, 'Loop', cfg);
    this.childRunning = false;
    this.currentQueue = null;
  }
  static manifest = {
    queue: manifestInout('queue', 'any', "Queue of elements, popped one at a time into 'value'"),
    if_empty: manifestInput('if_empty', 'status', 'SUCCESS', 'Status to return when the queue is empty and the child is not running'),
    value: manifestOutput('value', 'any', 'The element popped from the queue'),
  };
  halt() { this.childRunning = false; this.currentQueue = null; this.resetChild(); this.resetStatus(); }
  tick() {
    if (this.status() === STATUS.IDLE) { this.childRunning = false; this.currentQueue = null; }
    let popped = false;
    if (!this.childRunning) {
      if (!this.currentQueue) this.currentQueue = readQueue(this);
      if (this.currentQueue.length) { const v = this.currentQueue.shift(); this.setOutput('value', v); popped = true; }
    }
    if (!popped && !this.childRunning) {
      const o = this.tryGetInput('if_empty', 'status');
      return o.present ? o.value : STATUS.SUCCESS;
    }
    this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    this.childRunning = s === STATUS.RUNNING;
    if (isCompleted(s)) this.resetChild();
    return s === STATUS.FAILURE ? STATUS.FAILURE : STATUS.RUNNING;
  }
}
function readQueue(node) {
  const raw = node.tryGetInput('queue', 'any');
  if (!raw.present) return [];
  const v = raw.value;
  if (Array.isArray(v)) return [...v];
  if (v && typeof v === 'object' && typeof v.length === 'number') return [...v];
  return [];
}

export class EntryUpdatedDecorator extends DecoratorNode {
  constructor(name, cfg, ifNotUpdated) {
    super(name, ifNotUpdated === 'RUNNING' ? 'WaitValueUpdate' : 'SkipUnlessUpdated', cfg);
    const raw = cfg?.inputPorts?.entry;
    if (!raw) throw LogicError(`Missing port 'entry' in ${name}`);
    this.entryKey = isBlackboardPointer(raw) ? stripBlackboardPointer(raw) : raw;
    this.sequenceId = 0;
    this.stillExecutingChild = false;
    this.ifNotUpdated = ifNotUpdated;
  }
  static manifest = { entry: manifestInput('entry', 'any', undefined, 'Entry to check') };
  tick() {
    if (this.stillExecutingChild) {
      const s = this.childNode.executeTick();
      this.stillExecutingChild = s === STATUS.RUNNING;
      return s;
    }
    const entry = this.config.blackboard?.getEntry(this.entryKey);
    if (!entry) return this.ifNotUpdated;
    const currentId = entry.seq;
    const previousId = this.sequenceId;
    this.sequenceId = currentId;
    if (previousId === currentId) return this.ifNotUpdated;
    const s = this.childNode.executeTick();
    this.stillExecutingChild = s === STATUS.RUNNING;
    return s;
  }
  halt() { this.stillExecutingChild = false; this.resetChild(); this.resetStatus(); }
}

export class SubtreeNode extends DecoratorNode {
  constructor(name, cfg) { super(name, 'SubTree', cfg); this.subtreeId = cfg?.subtreeId || ''; }
  static manifest = { _autoremap: manifestInput('_autoremap', 'bool', 'false', 'If true, all the ports with the same name will be remapped') };
  tick() {
    if (this.status() === STATUS.IDLE) this.setStatus(STATUS.RUNNING);
    const s = this.childNode.executeTick();
    if (isCompleted(s)) this.resetChild();
    return s;
  }
}

/* ----- actions ----- */
export class AlwaysSuccessNode extends SyncActionNode {
  constructor(name, cfg) { super(name, 'AlwaysSuccess', cfg); }
  static manifest = {};
  doTick() { return STATUS.SUCCESS; }
}
export class AlwaysFailureNode extends SyncActionNode {
  constructor(name, cfg) { super(name, 'AlwaysFailure', cfg); }
  static manifest = {};
  doTick() { return STATUS.FAILURE; }
}
export class SleepNode extends StatefulActionNode {
  constructor(name, cfg) { super(name, 'Sleep', cfg); this.deadlineNanos = 0n; }
  static manifest = { msec: manifestInput('msec', 'int', undefined, 'Time to wait before returning SUCCESS') };
  onStart() {
    const msec = this.getInput('msec', 'int');
    if (msec <= 0) return STATUS.SUCCESS;
    this.deadlineNanos = simClock.now() + BigInt(msec) * 1_000_000n;
    return STATUS.RUNNING;
  }
  onRunning() { return simClock.now() >= this.deadlineNanos ? STATUS.SUCCESS : STATUS.RUNNING; }
  onHalted() {}
}
export class UnsetBlackboardNode extends SyncActionNode {
  constructor(name, cfg) { super(name, 'UnsetBlackboard', cfg); }
  static manifest = { key: manifestInput('key', 'any', undefined, 'Key of the entry to remove') };
  doTick() {
    this.config.blackboard.unset(this.getInput('key', 'any'));
    return STATUS.SUCCESS;
  }
}
export class ScriptNode extends SyncActionNode {
  constructor(name, cfg) { super(name, 'Script', cfg); this.executor = null; this.lastSource = null; }
  static manifest = { code: manifestInput('code', 'string', '', 'Piece of code that can be parsed') };
  loadExecutor() {
    const code = this.getInput('code', 'string');
    if (code === this.lastSource && this.executor) return;
    this.executor = parseScript(code);
    this.lastSource = code;
  }
  doTick() {
    this.loadExecutor();
    try { this.executor.evaluate(this.config.blackboard, this.config.enums); }
    catch (e) { e._msg = e._msg || e.message.replace(/'/g, `'`); throw e; }
    return STATUS.SUCCESS;
  }
}
export class ScriptConditionNode extends ConditionNode {
  constructor(name, cfg) { super(name, 'ScriptCondition', cfg); this.executor = null; this.lastSource = null; }
  static manifest = { code: manifestInput('code', 'any', undefined, 'Must return false or true') };
  loadExecutor() {
    const code = this.getInput('code', 'any');
    if (code === this.lastSource && this.executor) return;
    this.executor = parseScript(code);
    this.lastSource = code;
  }
  tick() {
    this.loadExecutor();
    const v = this.executor.evaluate(this.config.blackboard, this.config.enums);
    return truthy(v) ? STATUS.SUCCESS : STATUS.FAILURE;
  }
}
export class SetBlackboardNode extends SyncActionNode {
  constructor(name, cfg) { super(name, 'SetBlackboard', cfg); }
  static manifest = {
    value: manifestInput('value', 'any', undefined, 'Value to be written into the output_key'),
    output_key: manifestInput('output_key', 'any', undefined, 'Name of the blackboard entry where the value should be written'),
  };
  doTick() {
    const value = this.getInput('value', 'any');
    if (value === undefined || value === null) return STATUS.FAILURE;
    const dst = this.getInput('output_key', 'any');
    if (typeof dst !== 'string') throw RuntimeError2(`SetBlackboard: wrong output_key: ${dst}`);
    this.config.blackboard.set(dst, value);
    return STATUS.SUCCESS;
  }
}

/* ----- virtual (exercise-provided) nodes ----- */
export function makeVirtualNode(def, name, cfg) {
  const type = def.type || 'action';
  if (type === 'command') return new CommandActionLike(name, cfg, def);
  if (type === 'condition') return new ConditionNodeUser(name, cfg, def);
  if (type === 'stateful') return new StatefulActionNodeUser(name, cfg, def);
  return new ActionNodeUser(name, cfg, def);
}
export function manifestOfDef(def) {
  const m = {};
  for (const p of def.ports || []) {
    if (p.dir === 'output') m[p.name] = manifestOutput(p.name, p.type || 'any', p.desc);
    else if (p.dir === 'inout') m[p.name] = manifestInout(p.name, p.type || 'any', p.desc);
    else m[p.name] = manifestInput(p.name, p.type || 'any', p.default !== undefined ? String(p.default) : undefined, p.desc);
  }
  return m;
}
class ActionNodeUser extends TreeNode {
  constructor(name, cfg, def) { super(name, name, cfg); this.def = def; }
  manifestPorts() { return manifestOfDef(this.def); }
  tick() { return this.def.tick ? this.def.tick(ctxOf(this)) : STATUS.SUCCESS; }
}
class ConditionNodeUser extends ConditionNode {
  constructor(name, cfg, def) { super(name, name, cfg); this.def = def; }
  manifestPorts() { return manifestOfDef(this.def); }
  tick() {
    const s = this.def.tick ? this.def.tick(ctxOf(this)) : STATUS.SUCCESS;
    if (s === STATUS.RUNNING) throw LogicError(`Condition nodes must not return RUNNING — but [${this.nodeName}] did.`);
    return s;
  }
}
class StatefulActionNodeUser extends StatefulActionNode {
  constructor(name, cfg, def) { super(name, name, cfg); this.def = def; }
  manifestPorts() { return manifestOfDef(this.def); }
  onStart() { return this.def.onStart ? (this.def.onStart(ctxOf(this)) || STATUS.SUCCESS) : STATUS.SUCCESS; }
  onRunning() { return this.def.onRunning ? (this.def.onRunning(ctxOf(this)) || STATUS.RUNNING) : STATUS.RUNNING; }
  onHalted() { this.def.onHalted && this.def.onHalted(ctxOf(this)); }
}

/* CommandActionNode pattern (org.behaviortree.wpilib.CommandActionNode):
 * onStart() schedules a fresh command instance on each IDLE transition; the node is RUNNING
 * while the command is scheduled, SUCCESS once it is not; onHalted() cancels the command. */
class CommandActionLike extends StatefulActionNode {
  constructor(name, cfg, def) { super(name, name, cfg); this.def = def; this.command = null; }
  manifestPorts() { return manifestOfDef(this.def); }
  onStart() {
    this.command = this.def.supplier ? this.def.supplier(ctxOf(this)) : {};
    this.command._scheduled = true;
    return STATUS.RUNNING;
  }
  onRunning() { return this.command && this.command._scheduled ? STATUS.RUNNING : STATUS.SUCCESS; }
  onHalted() {
    if (this.command) { this.command._scheduled = false; this.command._cancelled = true; }
    this.command = null;
  }
}

export function ctxOf(node) {
  return {
    getInput: (k, t) => node.getInput(k, t),
    tryGetInput: (k, t) => node.tryGetInput(k, t),
    setOutput: (k, v) => node.setOutput(k, v),
    get blackboard() { return node.config.blackboard; },
    log: (msg) => console(msg),
    node: { name: node.nodeName, path: node.fullPath(), status: () => node.status() },
  };
}
function console(msg) {
  // the workspace collects log lines via a global hook
  if (typeof globalThis.__btLog === 'function') globalThis.__btLog(msg);
}

/* ----- literal parsing (mirrors Conversions + XmlTreeBuilder.inferLiteralValue) ----- */
const STATUS_WORDS = ['IDLE','RUNNING','SUCCESS','FAILURE','SKIPPED'];
export function parseLiteral(str, type, enums) {
  if (typeof str !== 'string') return str;
  const c = str.trim();
  if (type === 'string') return str;
  if (type === 'status') {
    const up = c.toUpperCase();
    if (STATUS_WORDS.includes(up)) return up;
    if (enums && c in enums) return String(enums[c]);
    return str;
  }
  if (type === 'any') {
    if (c === 'true') return true;
    if (c === 'false') return false;
    if (enums && c in enums) return Number(enums[c]);
    if (/^-?\d+(e[+-]?\d+)?$/i.test(c)) return Number(c);
    if (/^-?(\d+\.\d*|\.\d+|\d+[eE][+-]?\d+)([eE][+-]?\d+)?$/.test(c) && /[.e]/i.test(c)) return Number(c);
    return str;
  }
  if (type === 'int' || type === 'long') {
    if (enums && c in enums) return enums[c];
    const n = parseInt(c, 10);
    if (Number.isNaN(n)) throw RuntimeError2(`Cannot convert "${str}" to integer`);
    return n;
  }
  if (type === 'double' || type === 'float') {
    if (enums && c in enums) return Number(enums[c]);
    const n = Number(c);
    if (Number.isNaN(n) && c !== '') throw RuntimeError2(`Cannot convert "${str}" to double`);
    return n;
  }
  if (type === 'bool') {
    if (c === 'true') return true;
    if (c === 'false') return false;
    throw RuntimeError2(`"${str}" is not a boolean (expected 'true' or 'false')`);
  }
  return str;
}
