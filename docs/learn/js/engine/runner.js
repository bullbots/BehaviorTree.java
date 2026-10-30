// Run controller: builds a fresh Tree from XML + exercise config and drives ticks on the
// virtual clock. Mirrors how BehaviorTreeCommand ticks a tree once per robotPeriodic().
import { simClock, STATUS } from './clock.js';
import { createTreeFromText, Tree } from './factory.js';

export class Runner {
  constructor({ xml, nodes, enums, beforeTick }) {
    simClock.reset();
    this.tickIndex = 0;
    this.beforeTick = beforeTick;
    this.logLines = [];
    Object.defineProperty(globalThis, '__btLog', {
      value: (m) => this.logLines.push(String(m)), configurable: true, writable: true,
    });
    const built = createTreeFromText(xml, { nodes, enums });
    this.tree = built.tree;
    this.blackboard = built.blackboard;
    this.factory = built.factory;
    this.commands = []; // content scheduler can push active mock commands here
  }

  /** One robot periodic: advance the scheduler/robot, then one tree tick. */
  tick() {
    this.tickIndex++;
    simClock.advanceTick();
    try {
      if (this.beforeTick) this.beforeTick(this);
    } catch (e) {
      this.logLines.push(`[scheduler] ${e._msg || e.message}`);
    }
    const status = this.tree.tickOnce();
    return { status, tickIndex: this.tickIndex, simMs: simClock.ms };
  }

  /** Run until the tree finishes (or maxTicks). Returns the final tick result. */
  runUntilFinished(maxTicks = 400) {
    let last;
    for (let i = 0; i < maxTicks; i++) {
      last = this.tick();
      if (last.status === STATUS.SUCCESS || last.status === STATUS.FAILURE) break;
    }
    return last ?? { status: STATUS.IDLE, tickIndex: 0, simMs: 0 };
  }

  reset() {
    simClock.reset();
    this.tickIndex = 0;
    this.logLines = [];
    this.tree.haltTree();
  }

  /** Full node state snapshot for the visualizer: [{path, name, kind, reg, status, uid}] */
  snapshot() {
    const out = [];
    const walk = (node, depth, parentPath) => {
      const path = node.fullPath();
      out.push({
        path, name: node.nodeName, uid: node.nodeUid,
        kind: node.type ? node.type() : 'ACTION',
        reg: node.registrationName,
        status: node.status(),
        lastReturn: node.lastReturn,
        parent: parentPath,
        depth,
      });
      if (node.children) for (const c of node.children) walk(c, depth + 1, path);
      if (node.childNode) walk(node.childNode, depth + 1, path);
    };
    walk(this.tree.rootNode, 0, null);
    return out;
  }

  /** how many times each node returned a status (tick call counter) */
  tally() {
    const acc = [];
    const walk = (n) => {
      acc.push({ path: n.fullPath(), name: n.nodeName, reg: n.registrationName, count: n.ticksCount ?? 0 });
      if (n.children) for (const c of n.children) walk(c);
      if (n.childNode) walk(n.childNode);
    };
    walk(this.tree.rootNode);
    return acc;
  }
}
