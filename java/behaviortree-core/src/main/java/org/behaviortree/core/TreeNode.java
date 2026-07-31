package org.behaviortree.core;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.behaviortree.core.scripting.ScriptFunction;
import org.behaviortree.core.scripting.ScriptSupport;

/** Abstract base class for every behavior tree node. */
public abstract class TreeNode
{
  @FunctionalInterface
  public interface StatusChangeListener
  {
    void onStatusChange(long timeNanos, TreeNode node, NodeStatus prevStatus,
                        NodeStatus newStatus);
  }

  @FunctionalInterface
  public interface PreTickCallback
  {
    NodeStatus apply(TreeNode node);
  }

  @FunctionalInterface
  public interface PostTickCallback
  {
    NodeStatus apply(TreeNode node, NodeStatus status);
  }

  @FunctionalInterface
  public interface TickMonitorCallback
  {
    void apply(TreeNode node, NodeStatus status, long durationNanos);
  }

  public interface Subscription extends AutoCloseable
  {
    @Override
    void close();
  }

  private final String name;
  private NodeConfig config;
  private volatile NodeStatus status = NodeStatus.IDLE;
  private final Object stateLock = new Object();
  private String registrationId = "";
  private final List<StatusChangeListener> listeners = new CopyOnWriteArrayList<>();

  private volatile PreTickCallback preTickCallback;
  private volatile PostTickCallback postTickCallback;
  private volatile TickMonitorCallback tickMonitorCallback;

  private WakeUpSignal wakeUp;

  private final Map<PreCond, ScriptFunction> preScripts = new EnumMap<>(PreCond.class);
  private final Map<PostCond, ScriptFunction> postScripts = new EnumMap<>(PostCond.class);

  protected TreeNode(String name, NodeConfig config)
  {
    this.name = name;
    this.config = config;
  }

  /** The method used to invoke {@link #tick()}; always use this (never call tick() directly) so
   * that pre/post conditions, injected callbacks and exception wrapping are applied. */
  public NodeStatus executeTick()
  {
    NodeStatus newStatus = status;
    PreTickCallback preTick = preTickCallback;
    PostTickCallback postTick = postTickCallback;
    TickMonitorCallback monitorTick = tickMonitorCallback;

    Optional<NodeStatus> precond = checkPreConditions();
    if(precond.isPresent())
    {
      newStatus = precond.get();
    }
    else
    {
      boolean substituted = false;
      if(preTick != null && !status.isCompleted())
      {
        NodeStatus override = preTick.apply(this);
        if(override.isCompleted())
        {
          substituted = true;
          newStatus = override;
        }
      }

      if(!substituted)
      {
        long t1 = System.nanoTime();
        try
        {
          newStatus = tick();
        }
        catch(NodeExecutionError e)
        {
          throw e;
        }
        catch(RuntimeException ex)
        {
          throw new NodeExecutionError(name(), fullPath(), registrationName(),
                                       String.valueOf(ex.getMessage()), ex);
        }
        long t2 = System.nanoTime();
        if(monitorTick != null)
        {
          monitorTick.apply(this, newStatus, t2 - t1);
        }
      }
    }

    if(newStatus.isCompleted())
    {
      checkPostConditions(newStatus);
    }

    if(postTick != null)
    {
      NodeStatus override = postTick.apply(this, newStatus);
      if(override.isCompleted())
      {
        newStatus = override;
      }
    }

    // preserve the IDLE state if skipped, but communicate SKIPPED to the parent
    if(newStatus != NodeStatus.SKIPPED)
    {
      setStatus(newStatus);
    }
    return newStatus;
  }

  public final void haltNode()
  {
    halt();
    ScriptFunction onHalted = postScripts.get(PostCond.ON_HALTED);
    if(onHalted != null)
    {
      onHalted.evaluate(config.blackboard, config.enums);
    }
  }

  public boolean isHalted()
  {
    return status == NodeStatus.IDLE;
  }

  public NodeStatus status()
  {
    return status;
  }

  public String name()
  {
    return name;
  }

  /** Blocks the calling thread until the status is no longer IDLE. Intended for tests / manual
   * driving of a tree from a dedicated thread; not used when ticking from a periodic loop. */
  public NodeStatus waitValidStatus()
  {
    synchronized(stateLock)
    {
      while(isHalted())
      {
        try
        {
          stateLock.wait();
        }
        catch(InterruptedException e)
        {
          Thread.currentThread().interrupt();
          return status;
        }
      }
      return status;
    }
  }

  public abstract NodeType type();

  public Subscription subscribeToStatusChange(StatusChangeListener listener)
  {
    listeners.add(listener);
    return () -> listeners.remove(listener);
  }

  public void setPreTickFunction(PreTickCallback callback)
  {
    this.preTickCallback = callback;
  }

  public void setPostTickFunction(PostTickCallback callback)
  {
    this.postTickCallback = callback;
  }

  public void setTickMonitorCallback(TickMonitorCallback callback)
  {
    this.tickMonitorCallback = callback;
  }

  public int uid()
  {
    return config.uid;
  }

  public String fullPath()
  {
    return config.path;
  }

  public String registrationName()
  {
    return registrationId;
  }

  public NodeConfig config()
  {
    return config;
  }

  public <T> T getInput(String key, Class<T> type)
  {
    return getInputStamped(key, type).value;
  }

  public <T> Optional<T> tryGetInput(String key, Class<T> type)
  {
    try
    {
      return Optional.of(getInput(key, type));
    }
    catch(RuntimeException e)
    {
      return Optional.empty();
    }
  }

  @SuppressWarnings("unchecked")
  public <T> StampedValue<T> getInputStamped(String key, Class<T> type)
  {
    String portValueStr;

    String remap = config.inputPorts.get(key);
    if(remap != null)
    {
      portValueStr = remap;
    }
    else if(config.manifest == null)
    {
      throw new RuntimeError("getInput() of node '" + fullPath() + "' failed because the "
                             + "manifest is null and the key [" + key + "] is missing");
    }
    else
    {
      PortInfo portInfo = config.manifest.ports.get(key);
      if(portInfo == null)
      {
        throw new RuntimeError("getInput() of node '" + fullPath()
                               + "' failed because the manifest doesn't contain the key: [" + key
                               + "]");
      }
      if(!portInfo.hasDefaultValue())
      {
        throw new RuntimeError("getInput() of node '" + fullPath() + "' failed because nor the "
                               + "manifest or the XML contain the key: [" + key + "]");
      }
      if(portInfo.defaultValue() instanceof String s)
      {
        portValueStr = s;
      }
      else
      {
        return new StampedValue<>((T) portInfo.defaultValue(), Timestamp.ZERO);
      }
    }

    Optional<String> blackboardKey = getRemappedKey(key, portValueStr);
    if(blackboardKey.isEmpty())
    {
      // pure string literal, not a blackboard pointer
      T value = parseValue(type, portValueStr);
      return new StampedValue<>(value, Timestamp.ZERO);
    }

    if(config.blackboard == null)
    {
      throw new RuntimeError("getInput(): trying to access an invalid Blackboard");
    }

    Optional<StampedValue<T>> result = config.blackboard.tryGetStamped(blackboardKey.get(), type);
    if(result.isPresent())
    {
      return result.get();
    }
    throw new RuntimeError("getInput() failed because it was unable to find the key [" + key
                           + "] remapped to [" + blackboardKey.get() + "]");
  }

  @SuppressWarnings("unchecked")
  private <T> T parseValue(Class<T> type, String str)
  {
    if(type.isEnum() && type != NodeStatus.class)
    {
      Integer enumValue = config.enums.get(str);
      if(enumValue != null)
      {
        Object[] constants = type.getEnumConstants();
        return (T) constants[enumValue];
      }
      try
      {
        int idx = Integer.parseInt(str.trim());
        Object[] constants = type.getEnumConstants();
        return (T) constants[idx];
      }
      catch(NumberFormatException ignored)
      {
        // fall through
      }
    }
    return Conversions.convertFromString(type, str);
  }

  public <T> void setOutput(String key, T value)
  {
    if(config.blackboard == null)
    {
      throw new RuntimeError("setOutput() failed: trying to access a Blackboard entry, but the "
                             + "Blackboard is null");
    }
    String remap = config.outputPorts.get(key);
    if(remap == null)
    {
      throw new RuntimeError("setOutput() failed: NodeConfig.outputPorts does not contain the "
                             + "key: [" + key + "]");
    }
    if(remap.equals("{=}") || remap.equals("="))
    {
      config.blackboard.set(key, value);
      return;
    }
    if(!isBlackboardPointer(remap))
    {
      throw new RuntimeError("setOutput requires a blackboard pointer. Use {}");
    }
    String strippedKey = stripBlackboardPointer(remap);
    config.blackboard.set(strippedKey, value);
  }

  /** Returns the blackboard entry backing a port, creating it (using the manifest's declared
   * type) if it doesn't exist yet. Synchronize on the returned entry's {@code lock} field before
   * reading/writing its {@code value}, and release it promptly. */
  public Blackboard.Entry getLockedPortContent(String key)
  {
    Optional<String> remappedKey = getRemappedKey(key, getRawPortValue(key));
    if(remappedKey.isEmpty())
    {
      return null;
    }
    String bbKey = remappedKey.get();
    Blackboard.Entry entry = config.blackboard.getEntry(bbKey);
    if(entry == null && config.manifest != null)
    {
      PortInfo portInfo = config.manifest.ports.get(key);
      if(portInfo != null)
      {
        config.blackboard.createEntry(bbKey, portInfo);
        entry = config.blackboard.getEntry(bbKey);
      }
    }
    return entry;
  }

  public String getRawPortValue(String key)
  {
    String v = config.inputPorts.get(key);
    if(v != null)
    {
      return v;
    }
    v = config.outputPorts.get(key);
    if(v != null)
    {
      return v;
    }
    throw new LogicError("[" + key + "] not found");
  }

  public static boolean isBlackboardPointer(String str)
  {
    if(str == null)
    {
      return false;
    }
    String trimmed = str.strip();
    return trimmed.length() >= 3 && trimmed.charAt(0) == '{'
           && trimmed.charAt(trimmed.length() - 1) == '}';
  }

  public static String stripBlackboardPointer(String str)
  {
    if(!isBlackboardPointer(str))
    {
      return null;
    }
    String trimmed = str.strip();
    return trimmed.substring(1, trimmed.length() - 1);
  }

  public static Optional<String> getRemappedKey(String portName, String remappedPort)
  {
    if(remappedPort.equals("{=}") || remappedPort.equals("="))
    {
      return Optional.of(portName);
    }
    if(isBlackboardPointer(remappedPort))
    {
      return Optional.of(stripBlackboardPointer(remappedPort));
    }
    return Optional.empty();
  }

  public void emitWakeUpSignal()
  {
    if(wakeUp != null)
    {
      wakeUp.emitSignal();
    }
  }

  public boolean requiresWakeUp()
  {
    return wakeUp != null;
  }

  public void setWakeUpInstance(WakeUpSignal instance)
  {
    this.wakeUp = instance;
  }

  public void modifyPortsRemapping(Map<String, String> newRemapping)
  {
    for(Map.Entry<String, String> e : newRemapping.entrySet())
    {
      if(config.inputPorts.containsKey(e.getKey()))
      {
        config.inputPorts.put(e.getKey(), e.getValue());
      }
      if(config.outputPorts.containsKey(e.getKey()))
      {
        config.outputPorts.put(e.getKey(), e.getValue());
      }
    }
  }

  public void setPreConditionScript(PreCond cond, ScriptFunction fn)
  {
    preScripts.put(cond, fn);
  }

  public void setPostConditionScript(PostCond cond, ScriptFunction fn)
  {
    postScripts.put(cond, fn);
  }

  public void setRegistrationId(String id)
  {
    this.registrationId = id;
  }

  /** Sets the status to IDLE, without calling {@link #halt()}. Intended for use by parent
   * Control/Decorator nodes once a child has finished, and by the factory/Tree when resetting. */
  public void resetStatus()
  {
    NodeStatus prev;
    synchronized(stateLock)
    {
      prev = status;
      status = NodeStatus.IDLE;
      stateLock.notifyAll();
    }
    if(prev != NodeStatus.IDLE)
    {
      notifyListeners(prev, NodeStatus.IDLE);
    }
  }

  /** Changes the status of the node; throws if asked to set IDLE (use {@link #resetStatus()}
   * instead). Intended to be called only from within a node's own {@code tick()}. */
  protected void setStatus(NodeStatus newStatus)
  {
    if(newStatus == NodeStatus.IDLE)
    {
      throw new RuntimeError("Node [" + name() + "]: you are not allowed to set manually the "
                             + "status to IDLE. If you know what you are doing, use "
                             + "resetStatus() instead.");
    }
    NodeStatus prev;
    synchronized(stateLock)
    {
      prev = status;
      status = newStatus;
      stateLock.notifyAll();
    }
    if(prev != newStatus)
    {
      notifyListeners(prev, newStatus);
    }
  }

  private void notifyListeners(NodeStatus prev, NodeStatus next)
  {
    long now = System.nanoTime();
    for(StatusChangeListener l : listeners)
    {
      l.onStatusChange(now, this, prev, next);
    }
  }

  /** The method to be implemented by concrete node types. Never call this directly; always go
   * through {@link #executeTick()}. */
  protected abstract NodeStatus tick();

  /** Interrupts a RUNNING node. Only asynchronous nodes that may return RUNNING need a real
   * implementation; call {@link #haltNode()}, never this method, to halt a node. */
  protected abstract void halt();

  private Optional<NodeStatus> checkPreConditions()
  {
    if(preScripts.isEmpty())
    {
      return Optional.empty();
    }
    for(PreCond cond : PreCond.values())
    {
      ScriptFunction fn = preScripts.get(cond);
      if(fn == null)
      {
        continue;
      }
      if(status == NodeStatus.IDLE || status == NodeStatus.SKIPPED)
      {
        boolean result = ScriptSupport.toBoolean(fn.evaluate(config.blackboard, config.enums));
        if(result)
        {
          if(cond == PreCond.FAILURE_IF)
          {
            return Optional.of(NodeStatus.FAILURE);
          }
          if(cond == PreCond.SUCCESS_IF)
          {
            return Optional.of(NodeStatus.SUCCESS);
          }
          if(cond == PreCond.SKIP_IF)
          {
            return Optional.of(NodeStatus.SKIPPED);
          }
        }
        else if(cond == PreCond.WHILE_TRUE)
        {
          return Optional.of(NodeStatus.SKIPPED);
        }
      }
      else if(status == NodeStatus.RUNNING && cond == PreCond.WHILE_TRUE)
      {
        boolean result = ScriptSupport.toBoolean(fn.evaluate(config.blackboard, config.enums));
        if(!result)
        {
          haltNode();
          return Optional.of(NodeStatus.SKIPPED);
        }
      }
    }
    return Optional.empty();
  }

  private void checkPostConditions(NodeStatus status)
  {
    if(postScripts.isEmpty())
    {
      return;
    }
    if(status == NodeStatus.SUCCESS)
    {
      runPostScript(PostCond.ON_SUCCESS);
    }
    else if(status == NodeStatus.FAILURE)
    {
      runPostScript(PostCond.ON_FAILURE);
    }
    runPostScript(PostCond.ALWAYS);
  }

  private void runPostScript(PostCond cond)
  {
    ScriptFunction fn = postScripts.get(cond);
    if(fn != null)
    {
      fn.evaluate(config.blackboard, config.enums);
    }
  }
}
