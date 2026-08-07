package org.behaviortree.core;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.behaviortree.core.actions.AlwaysFailureNode;
import org.behaviortree.core.actions.AlwaysSuccessNode;
import org.behaviortree.core.actions.ScriptConditionNode;
import org.behaviortree.core.actions.ScriptNode;
import org.behaviortree.core.actions.SetBlackboardNode;
import org.behaviortree.core.actions.SleepNode;
import org.behaviortree.core.actions.UnsetBlackboardNode;
import org.behaviortree.core.controls.FallbackNode;
import org.behaviortree.core.controls.IfThenElseNode;
import org.behaviortree.core.controls.ParallelAllNode;
import org.behaviortree.core.controls.ParallelNode;
import org.behaviortree.core.controls.ReactiveFallback;
import org.behaviortree.core.controls.ReactiveSequence;
import org.behaviortree.core.controls.SequenceNode;
import org.behaviortree.core.controls.SequenceWithMemoryNode;
import org.behaviortree.core.controls.SwitchNode;
import org.behaviortree.core.controls.WhileDoElseNode;
import org.behaviortree.core.decorators.DelayNode;
import org.behaviortree.core.decorators.EntryUpdatedDecorator;
import org.behaviortree.core.decorators.ForceFailureNode;
import org.behaviortree.core.decorators.ForceSuccessNode;
import org.behaviortree.core.decorators.InverterNode;
import org.behaviortree.core.decorators.KeepRunningUntilFailureNode;
import org.behaviortree.core.decorators.LoopNode;
import org.behaviortree.core.decorators.PreconditionNode;
import org.behaviortree.core.decorators.RepeatNode;
import org.behaviortree.core.decorators.RetryNode;
import org.behaviortree.core.decorators.RunOnceNode;
import org.behaviortree.core.decorators.SubtreeNode;
import org.behaviortree.core.decorators.TimeoutNode;
import org.behaviortree.core.scripting.ScriptParser;
import org.w3c.dom.Element;

/**
 * Registers node types (built-in and user-defined) and builds {@link Tree} instances from XML,
 * equivalent to BT::BehaviorTreeFactory.
 */
public final class BehaviorTreeFactory
{
  private final Map<String, NodeBuilder> builders = new LinkedHashMap<>();
  private final Map<String, TreeNodeManifest> manifests = new LinkedHashMap<>();
  private final Map<String, Integer> scriptingEnums = new LinkedHashMap<>();
  private final Map<String, Element> treeDefinitions = new LinkedHashMap<>();
  private final Map<String, PortsList> subtreeModels = new LinkedHashMap<>();
  private String mainTreeToExecute;

  public BehaviorTreeFactory()
  {
    registerBuiltinNodes();
  }

  // ---------------------------------------------------------------- registration

  public Map<String, TreeNodeManifest> manifests()
  {
    return manifests;
  }

  Map<String, Element> treeDefinitions()
  {
    return treeDefinitions;
  }

  Map<String, PortsList> subtreeModels()
  {
    return subtreeModels;
  }

  Map<String, Integer> scriptingEnums()
  {
    return scriptingEnums;
  }

  public void registerScriptingEnum(String name, int value)
  {
    scriptingEnums.put(name, value);
  }

  public <E extends Enum<E>> void registerScriptingEnums(Class<E> enumType)
  {
    for(E constant : enumType.getEnumConstants())
    {
      scriptingEnums.put(constant.name(), constant.ordinal());
    }
  }

  /** Registers a node type by reflection: {@code clazz} must have a public
   * {@code (String name, NodeConfig config)} constructor, and may optionally declare a public
   * static {@code PortsList providedPorts()} method. */
  public <T extends TreeNode> void registerNodeType(String id, Class<T> clazz)
  {
    Constructor<T> ctor;
    try
    {
      ctor = clazz.getConstructor(String.class, NodeConfig.class);
    }
    catch(NoSuchMethodException e)
    {
      throw new LogicError("registerNodeType(" + id + "): " + clazz.getName() + " must have a "
                           + "public constructor (String name, NodeConfig config)");
    }
    PortsList ports = lookupProvidedPorts(clazz);
    NodeType type = inferNodeType(clazz);
    registerNodeType(id, ports, type, (name, config) -> {
      try
      {
        return ctor.newInstance(name, config);
      }
      catch(InvocationTargetException e)
      {
        Throwable cause = e.getCause() != null ? e.getCause() : e;
        if(cause instanceof RuntimeException re)
        {
          throw re;
        }
        throw new BehaviorTreeException("Failed to instantiate " + clazz.getName(), cause);
      }
      catch(ReflectiveOperationException e)
      {
        throw new BehaviorTreeException("Failed to instantiate " + clazz.getName(), e);
      }
    });
  }

  /** Registers a node type with an explicit ports list, node category and builder function. Use
   * this when a node's constructor takes extra arguments beyond (name, config), or when you
   * don't want to rely on reflection. */
  public void registerNodeType(String id, PortsList ports, NodeType type, NodeBuilder builder)
  {
    if(builders.containsKey(id))
    {
      throw new LogicError("BehaviorTreeFactory: node type already registered: " + id);
    }
    builders.put(id, builder);
    manifests.put(id, new TreeNodeManifest(type, id, ports, new LinkedHashMap<>()));
  }

  public void registerSimpleAction(String id, SimpleActionNode.TickFunctor functor)
  {
    registerSimpleAction(id, functor, new PortsList());
  }

  public void registerSimpleAction(String id, SimpleActionNode.TickFunctor functor,
                                   PortsList ports)
  {
    registerNodeType(id, ports, NodeType.ACTION,
                     (name, config) -> new SimpleActionNode(name, functor, config));
  }

  public void registerSimpleCondition(String id, SimpleConditionNode.TickFunctor functor)
  {
    registerSimpleCondition(id, functor, new PortsList());
  }

  public void registerSimpleCondition(String id, SimpleConditionNode.TickFunctor functor,
                                      PortsList ports)
  {
    registerNodeType(id, ports, NodeType.CONDITION,
                     (name, config) -> new SimpleConditionNode(name, functor, config));
  }

  private static PortsList lookupProvidedPorts(Class<?> clazz)
  {
    try
    {
      Method m = clazz.getMethod("providedPorts");
      if(Modifier.isStatic(m.getModifiers()) && PortsList.class.isAssignableFrom(
          m.getReturnType()))
      {
        return (PortsList) m.invoke(null);
      }
    }
    catch(NoSuchMethodException e)
    {
      // no ports declared, that's fine
    }
    catch(ReflectiveOperationException e)
    {
      throw new LogicError("Failed to invoke providedPorts() on " + clazz.getName() + ": "
                           + e.getMessage());
    }
    return new PortsList();
  }

  private static NodeType inferNodeType(Class<?> clazz)
  {
    if(SubtreeNode.class.isAssignableFrom(clazz))
    {
      return NodeType.SUBTREE;
    }
    if(ControlNode.class.isAssignableFrom(clazz))
    {
      return NodeType.CONTROL;
    }
    if(DecoratorNode.class.isAssignableFrom(clazz))
    {
      return NodeType.DECORATOR;
    }
    if(ConditionNode.class.isAssignableFrom(clazz))
    {
      return NodeType.CONDITION;
    }
    if(ActionNodeBase.class.isAssignableFrom(clazz))
    {
      return NodeType.ACTION;
    }
    throw new LogicError("registerNodeType(): " + clazz.getName() + " does not extend "
                         + "ActionNodeBase, ConditionNode, ControlNode or DecoratorNode");
  }

  // ---------------------------------------------------------------- instantiation

  /** Builds a node instance for {@code registrationId}, wires its manifest/enums/pre-post-
   * condition scripts, and returns it. Used both directly and by the XML parser. */
  public TreeNode instantiateTreeNode(String name, String registrationId, NodeConfig config)
  {
    NodeBuilder builder = builders.get(registrationId);
    if(builder == null)
    {
      throw new RuntimeError("BehaviorTreeFactory: node not registered: " + registrationId);
    }
    config.manifest = manifests.get(registrationId);
    config.enums = scriptingEnums;

    TreeNode node = builder.build(name, config);
    node.setRegistrationId(registrationId);

    for(Map.Entry<PreCond, String> e : config.preConditions.entrySet())
    {
      node.setPreConditionScript(e.getKey(), ScriptParser.parse(e.getValue()));
    }
    for(Map.Entry<PostCond, String> e : config.postConditions.entrySet())
    {
      node.setPostConditionScript(e.getKey(), ScriptParser.parse(e.getValue()));
    }
    return node;
  }

  // ---------------------------------------------------------------- XML loading

  public void clearRegisteredBehaviorTrees()
  {
    treeDefinitions.clear();
    subtreeModels.clear();
    mainTreeToExecute = null;
  }

  public void registerBehaviorTreeFromFile(Path path)
  {
    String text;
    try
    {
      text = Files.readString(path);
    }
    catch(java.io.IOException e)
    {
      throw new RuntimeError("Cannot read file [" + path + "]: " + e.getMessage());
    }
    Path basePath = path.toAbsolutePath().getParent();
    new XmlTreeBuilder(this).registerFromText(text, basePath);
  }

  public void registerBehaviorTreeFromText(String xmlText)
  {
    new XmlTreeBuilder(this).registerFromText(xmlText, null);
  }

  void setMainTreeToExecute(String id)
  {
    if(id != null && !id.isEmpty())
    {
      this.mainTreeToExecute = id;
    }
  }

  String mainTreeToExecute()
  {
    return mainTreeToExecute;
  }

  public Tree createTree(String mainTreeId)
  {
    return createTree(mainTreeId, Blackboard.create());
  }

  public Tree createTree(String mainTreeId, Blackboard rootBlackboard)
  {
    return new XmlTreeBuilder(this).instantiateTree(rootBlackboard, mainTreeId);
  }

  public Tree createTreeFromText(String xmlText)
  {
    return createTreeFromText(xmlText, Blackboard.create());
  }

  public Tree createTreeFromText(String xmlText, Blackboard rootBlackboard)
  {
    registerBehaviorTreeFromText(xmlText);
    return createTree(null, rootBlackboard);
  }

  public Tree createTreeFromFile(Path path)
  {
    return createTreeFromFile(path, Blackboard.create());
  }

  public Tree createTreeFromFile(Path path, Blackboard rootBlackboard)
  {
    registerBehaviorTreeFromFile(path);
    return createTree(null, rootBlackboard);
  }

  // ---------------------------------------------------------------- built-ins

  private void registerBuiltinNodes()
  {
    registerNodeType("ReactiveSequence", ReactiveSequence.class);
    registerNodeType("ReactiveFallback", ReactiveFallback.class);
    registerNodeType("IfThenElse", IfThenElseNode.class);
    registerNodeType("WhileDoElse", WhileDoElseNode.class);
    registerNodeType("Parallel", ParallelNode.class);
    registerNodeType("ParallelAll", ParallelAllNode.class);
    registerNodeType("SequenceWithMemory", SequenceWithMemoryNode.class);
    registerNodeType("SequenceStar", SequenceWithMemoryNode.class);

    registerNodeType("Sequence", new PortsList(), NodeType.CONTROL,
                     (name, config) -> new SequenceNode(name, config, false));
    registerNodeType("AsyncSequence", new PortsList(), NodeType.CONTROL,
                     (name, config) -> new SequenceNode(name, config, true));
    registerNodeType("Fallback", new PortsList(), NodeType.CONTROL,
                     (name, config) -> new FallbackNode(name, config, false));
    registerNodeType("AsyncFallback", new PortsList(), NodeType.CONTROL,
                     (name, config) -> new FallbackNode(name, config, true));

    for(int n = 2; n <= 6; n++)
    {
      int numCases = n;
      registerNodeType("Switch" + n, SwitchNode.providedPorts(numCases), NodeType.CONTROL,
                       (name, config) -> new SwitchNode(name, config, numCases));
    }

    registerNodeType("Inverter", InverterNode.class);
    registerNodeType("RetryUntilSuccessful", RetryNode.class);
    registerNodeType("KeepRunningUntilFailure", KeepRunningUntilFailureNode.class);
    registerNodeType("Repeat", RepeatNode.class);
    registerNodeType("Timeout", TimeoutNode.class);
    registerNodeType("Delay", DelayNode.class);
    registerNodeType("RunOnce", RunOnceNode.class);
    registerNodeType("ForceSuccess", ForceSuccessNode.class);
    registerNodeType("ForceFailure", ForceFailureNode.class);
    registerNodeType("Precondition", PreconditionNode.class);
    registerNodeType("Loop", LoopNode.class);
    registerNodeType("SubTree", SubtreeNode.class);

    registerNodeType("SkipUnlessUpdated", EntryUpdatedDecorator.providedPorts(),
                     NodeType.DECORATOR,
                     (name, config) -> new EntryUpdatedDecorator(name, config,
                                                                 NodeStatus.SKIPPED));
    registerNodeType("WaitValueUpdate", EntryUpdatedDecorator.providedPorts(),
                     NodeType.DECORATOR,
                     (name, config) -> new EntryUpdatedDecorator(name, config,
                                                                 NodeStatus.RUNNING));

    registerNodeType("AlwaysSuccess", AlwaysSuccessNode.class);
    registerNodeType("AlwaysFailure", AlwaysFailureNode.class);
    registerNodeType("Script", ScriptNode.class);
    registerNodeType("ScriptCondition", ScriptConditionNode.class);
    registerNodeType("SetBlackboard", SetBlackboardNode.class);
    registerNodeType("UnsetBlackboard", UnsetBlackboardNode.class);
    registerNodeType("Sleep", SleepNode.class);
  }
}
