// Faithful JS port of org.behaviortree.core.XmlTreeBuilder + BehaviorTreeFactory + Tree.
// Supports: <root main_tree_to_execute>, <BehaviorTree ID>, compact + explicit tags
// (<Action ID="...">/<Condition>/<Control>/<Decorator>), <SubTree> remapping/_autoremap/{=},
// <TreeNodesModel> mandatory-port validation, special attributes (_skipIf/_successIf/
// _failureIf/_while/_onSuccess/_onFailure/_onHalted/_post), and exercise-provided virtual nodes.
import { Blackboard } from './blackboard.js';
import { parseScript } from './script.js';
import { STATUS } from './clock.js';
import * as N from './nodes.js';
import { parseXmlDoc } from './xmltext.js';

class ParseError extends Error { constructor(m) { super(m); this.name = 'XMLParseError'; this._msg = m; } }

const PRE_COND = ['_failureIf', '_successIf', '_skipIf', '_while'];
const POST_COND = ['_onHalted', '_onSuccess', '_onFailure', '_post'];
const EXPLICIT_TAGS = new Set(['Action', 'Condition', 'Control', 'Decorator']);

function builtinRegistry() {
  return {
    Sequence: (n, c) => new N.SequenceNode(n, c, false),
    AsyncSequence: (n, c) => new N.SequenceNode(n, c, true),
    SequenceWithMemory: (n, c) => new N.SequenceWithMemoryNode(n, c),
    SequenceStar: (n, c) => new N.SequenceWithMemoryNode(n, c),
    Fallback: (n, c) => new N.FallbackNode(n, c, false),
    AsyncFallback: (n, c) => new N.FallbackNode(n, c, true),
    ReactiveSequence: (n, c) => new N.ReactiveSequence(n, c),
    ReactiveFallback: (n, c) => new N.ReactiveFallback(n, c),
    Parallel: (n, c) => new N.ParallelNode(n, c),
    ParallelAll: (n, c) => new N.ParallelAllNode(n, c),
    IfThenElse: (n, c) => new N.IfThenElseNode(n, c),
    WhileDoElse: (n, c) => new N.WhileDoElseNode(n, c),
    Inverter: (n, c) => new N.InverterNode(n, c),
    ForceSuccess: (n, c) => new N.ForceSuccessNode(n, c),
    ForceFailure: (n, c) => new N.ForceFailureNode(n, c),
    RetryUntilSuccessful: (n, c) => new N.RetryNode(n, c),
    Retry: (n, c) => new N.RetryNode(n, c),
    Repeat: (n, c) => new N.RepeatNode(n, c),
    Timeout: (n, c) => new N.TimeoutNode(n, c),
    Delay: (n, c) => new N.DelayNode(n, c),
    KeepRunningUntilFailure: (n, c) => new N.KeepRunningUntilFailureNode(n, c),
    RunOnce: (n, c) => new N.RunOnceNode(n, c),
    Precondition: (n, c) => new N.PreconditionNode(n, c),
    Loop: (n, c) => new N.LoopNode(n, c),
    SubTree: (n, c) => new N.SubtreeNode(n, c),
    SkipUnlessUpdated: (n, c) => new N.EntryUpdatedDecorator(n, c, 'SKIPPED'),
    WaitValueUpdate: (n, c) => new N.EntryUpdatedDecorator(n, c, 'RUNNING'),
    AlwaysSuccess: (n, c) => new N.AlwaysSuccessNode(n, c),
    AlwaysFailure: (n, c) => new N.AlwaysFailureNode(n, c),
    Script: (n, c) => new N.ScriptNode(n, c),
    ScriptCondition: (n, c) => new N.ScriptConditionNode(n, c),
    SetBlackboard: (n, c) => new N.SetBlackboardNode(n, c),
    UnsetBlackboard: (n, c) => new N.UnsetBlackboardNode(n, c),
    Sleep: (n, c) => new N.SleepNode(n, c),
  };
}

function bump(el) { return [...el.children].filter((c) => c.nodeType === 1 && c.tagName !== 'TreeNodesModel'); }

export class Factory {
  constructor(opts = {}) {
    this.builtins = builtinRegistry();
    this.virtual = opts.nodes || {};
    this.enums = { ...(opts.enums || {}) };
    this.registeredTrees = new Map(); // id -> <BehaviorTree> element
    this.models = new Map();          // subtree id -> {ports}
  }

  build(xmlText) {
    this.registeredTrees.clear();
    this.models.clear();
    let rootEl;
    try { rootEl = parseXmlDoc(xmlText); }
    catch (e) { throw new ParseError(`Invalid XML: ${e.message}`); }
    if (rootEl.tagName !== 'root') throw new ParseError('The XML must have a <root> top element.');
    if (rootEl.querySelector('include')) throw new ParseError('<include> of external files is not available in the simulator. Put every <BehaviorTree> into the same document instead.');

    for (const t of [...rootEl.children].filter((c) => c.tagName === 'BehaviorTree')) {
      const id = t.getAttribute('ID');
      if (!id) throw new ParseError('Every <BehaviorTree> needs an ID="..." attribute.');
      if (this.registeredTrees.has(id)) throw new ParseError(`Duplicate <BehaviorTree ID="${id}">.`);
      this.registeredTrees.set(id, t);
    }
    if (!this.registeredTrees.size) throw new ParseError('The XML must contain at least one <BehaviorTree>.');

    for (const m of [...rootEl.children].filter((c) => c.tagName === 'TreeNodesModel')) {
      for (const s of [...m.children].filter((c) => c.tagName === 'SubTree')) {
        const sid = s.getAttribute('ID');
        if (!sid) continue;
        const ports = {};
        for (const p of [...s.children]) {
          const nm = p.getAttribute('name');
          if (!nm) continue;
          ports[nm] = { dir: p.tagName.replace('_port', ''), default: p.getAttribute('default') ?? undefined };
        }
        this.models.set(sid, { ports });
      }
    }

    let mainId = rootEl.getAttribute('main_tree_to_execute');
    if (!mainId) {
      if (this.registeredTrees.size !== 1) {
        throw new ParseError('Add main_tree_to_execute="..." to <root>, or provide exactly one <BehaviorTree>.');
      }
      mainId = [...this.registeredTrees.keys()][0];
    }
    const mainEl = this.registeredTrees.get(mainId);
    if (!mainEl) throw new ParseError(`main_tree_to_execute="${mainId}" does not name a <BehaviorTree> in this document.`);

    const blackboard = Blackboard.create();
    const ctx = { blackboard, path: mainId };
    const root = this.buildTreeBody(mainEl, ctx, []);
    return { root, blackboard, mainId, treeIds: [...this.registeredTrees.keys()] };
  }

  /** A <BehaviorTree> has exactly one root child. */
  buildTreeBody(treeEl, ctx, allNames) {
    const kids = bump(treeEl);
    if (!kids.length) throw new ParseError(`<BehaviorTree ID="${treeEl.getAttribute('ID')}"> has no children.`);
    if (kids.length > 1) throw new ParseError(`<BehaviorTree> must have exactly one root node (children of <BehaviorTree> must not be siblings).`);
    return this.buildNode(kids[0], ctx, allNames);
  }

  buildNode(el, ctx, allNames) {
    const tagName = el.tagName;
    const explicit = EXPLICIT_TAGS.has(tagName);
    const isSubtree = tagName === 'SubTree';

    let registrationId; // the node kind / referenced tree
    if (isSubtree) {
      registrationId = el.getAttribute('ID');
      if (!registrationId) throw new ParseError('<SubTree> needs an ID="..." naming a <BehaviorTree>.');
      if (!this.registeredTrees.has(registrationId)) {
        throw new ParseError(`SubTree refers to <BehaviorTree ID="${registrationId}"> which is not defined in this document.`);
      }
    } else if (explicit) {
      registrationId = el.getAttribute('ID');
      if (!registrationId) throw new ParseError(`<${tagName}> needs an ID="..." attribute.`);
    } else {
      registrationId = tagName;
    }

    const nodeName = el.getAttribute('name') || registrationId;

    // ---- classify attributes ----
    const inputPorts = {}, outputPorts = {}, otherAttributes = {};
    const preFns = {}, postFns = {};
    const manifest = this.manifestFor(registrationId);

    for (const attr of [...el.attributes]) {
      const key = attr.name, value = attr.value;
      if (key === 'name' || key === 'ID' || key === 'BTCPP_format') continue;
      if (PRE_COND.includes(key) || POST_COND.includes(key)) {
        let fn;
        try { fn = parseScript(value); }
        catch (e) { throw new ParseError(`While parsing [${key}] '${value}' for node ${nodeName}: ${e.message}`); }
        (PRE_COND.includes(key) ? preFns : postFns)[key] = fn;
        continue;
      }
      const info = manifest[key];
      if (info) {
        if (info.dir === 'output') outputPorts[key] = value;
        else inputPorts[key] = value;
      } else if (isSubtree) {
        otherAttributes[key] = value;
      } else if (this.models.has(nodeName)) {
        otherAttributes[key] = value;
      } else {
        throw new ParseError(`Attribute '${key}' is not a declared port of '${registrationId}'. (Check spelling: ports are defined by the node's providedPorts.)`);
      }
    }

    const cfg = {
      blackboard: ctx.blackboard,
      enums: this.enums,
      inputPorts, outputPorts, otherAttributes,
      path: `${ctx.path}/${nodeName}`,
      preFns, postFns,
    };

    // ---- instantiate ----
    const node = isSubtree
      ? this.instantiateSubtree(nodeName, registrationId, cfg, otherAttributes, ctx, allNames)
      : this.instantiate(registrationId, nodeName, cfg);

    for (const [k, fn] of Object.entries(preFns)) node.setPreConditionScript(k, fn);
    for (const [k, fn] of Object.entries(postFns)) node.setPostConditionScript(k, fn);
    allNames.push(nodeName);

    // ---- recurse into children by node kind ----
    const childCtx = { blackboard: cfg.blackboard, path: node.config.path };
    if (node instanceof N.ControlNode) {
      const kids = bump(el);
      if (!kids.length) throw new ParseError(`Control node <${registrationId}> needs children.`);
      for (const c of kids) node.addChild(this.buildNode(c, childCtx, allNames));
    } else if (node instanceof N.DecoratorNode) {
      const kids = bump(el);
      if (kids.length !== 1) throw new ParseError(`Decorator <${registrationId}> must have exactly one child.`);
      node.setChild(this.buildNode(kids[0], childCtx, allNames));
    } else {
      const kids = bump(el);
      if (kids.length) throw new ParseError(`Leaf node <${registrationId}> cannot have children.`);
    }
    return node;
  }

  instantiate(registrationId, nodeName, cfg) {
    const builder = this.builtins[registrationId];
    if (builder) return builder(nodeName, cfg);
    const sw = /^Switch([2-6])$/.exec(registrationId);
    if (sw) return new N.SwitchNode(nodeName, cfg, Number(sw[1]));
    const vdef = this.virtual[registrationId];
    if (vdef) return N.makeVirtualNode(vdef, nodeName, cfg);
    throw new ParseError(`Unknown node: '${registrationId}'. It is not a built-in and no virtual node was provided for it — check the spelling.`);
  }

  manifestFor(registrationId) {
    const sw = /^Switch([2-6])$/.exec(registrationId);
    if (sw) return N.SwitchNode.manifestFor(Number(sw[1]));
    const builder = this.builtins[registrationId];
    if (builder) {
      try {
        const probe = builder('_x', { inputPorts: {}, outputPorts: {}, otherAttributes: {}, enums: {} });
        return probe.manifestPorts();
      } catch { return {}; }
    }
    const vdef = this.virtual[registrationId];
    if (vdef) return N.manifestOfDef(vdef);
    return {};
  }

  instantiateSubtree(nodeName, subId, cfg, otherAttributes, ctx, allNames) {
    const subEl = this.registeredTrees.get(subId);
    if (!subEl) throw new ParseError(`SubTree refers to <BehaviorTree ID=\"${subId}\"> which does not exist in this document`);

    const childBb = Blackboard.create(cfg.blackboard);
    const autoRaw = otherAttributes._autoremap;
    if (autoRaw === '1' || autoRaw === 'true') childBb.autoRemapping = true;

    for (const [key, value] of Object.entries(otherAttributes)) {
      if (key.startsWith('_')) continue;
      if (value === '=' || value === '{=}') {
        childBb.addSubtreeRemapping(key, key); // {=}: use the port's own name in the parent
        continue;
      }
      if (N.isBlackboardPointer(value)) {
        childBb.addSubtreeRemapping(key, N.stripBlackboardPointer(value));
        continue;
      }
      // literal: stays a plain literal on the port (handled by getInput) — but pre-create the
      // child entry with correct inferred type so child writes type-lock like the Java port
      childBb.createEntry(key, 'any', value);
    }

    // TreeNodesModel mandatory port validation
    const model = this.models.get(subId);
    if (model) {
      for (const [pname, info] of Object.entries(model.ports)) {
        const remapped = pname in otherAttributes;
        if (!remapped && info.dir === 'input' && info.default === undefined) {
          throw new ParseError(`SubTree "${subId}" requires a mandatory input port [${pname}] — remap it or give it a default in its <TreeNodesModel>.`);
        }
      }
    }

    const subNode = new N.SubtreeNode(nodeName, cfg);
    subNode.subtreeId = subId;
    subNode.blackboardRef = childBb;
    const inner = this.buildTreeBody(subEl, { blackboard: childBb, path: cfg.path }, allNames);
    subNode.setChild(inner);
    return subNode;
  }
}

/* ---------------- Tree ---------------- */
export class Tree {
  constructor(root, blackboard) {
    this.rootNode = root;
    this.rootBlackboard = blackboard;
  }
  tickOnce() { return this.rootNode.executeTick(); }
  haltTree() {
    const walk = (node) => {
      if (node.children) for (const c of node.children) walk(c);
      if (node.childNode) walk(node.childNode);
      try {
        if (node.status && node.status() === STATUS.RUNNING) node.haltNode();
        node.resetStatus();
      } catch { /* keep halting */ }
    };
    walk(this.rootNode);
  }
}

/** Convenience API used by exercises and the test harness. */
export function createTreeFromText(xmlText, opts = {}) {
  const factory = new Factory(opts);
  const built = factory.build(xmlText);
  return { tree: new Tree(built.root, built.blackboard), blackboard: built.blackboard, factory: factory };
}
