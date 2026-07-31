package org.behaviortree.core;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * The preferred way to implement asynchronous actions: a request/reply-style pattern where
 * {@link #onStart()} is called once when the node transitions from IDLE, {@link #onRunning()} is
 * called on every subsequent tick while the node stays RUNNING, and {@link #onHalted()} is called
 * if and only if the node is halted while RUNNING. This maps directly onto the FRC command
 * lifecycle ({@code initialize}/{@code execute}/{@code end}).
 */
public abstract class StatefulActionNode extends ActionNodeBase
{
  private final AtomicBoolean haltRequested = new AtomicBoolean(false);

  protected StatefulActionNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  /** Called once, when transitioning from IDLE. If it returns RUNNING, the node becomes async. */
  public abstract NodeStatus onStart();

  /** Called on each tick while the node is RUNNING. */
  public abstract NodeStatus onRunning();

  /** Called when {@link TreeNode#haltNode()} is invoked while the node is RUNNING. */
  public abstract void onHalted();

  public boolean isHaltRequested()
  {
    return haltRequested.get();
  }

  @Override
  protected final NodeStatus tick()
  {
    NodeStatus prevStatus = status();
    if(prevStatus == NodeStatus.IDLE)
    {
      NodeStatus newStatus = onStart();
      if(newStatus == NodeStatus.IDLE)
      {
        throw new LogicError("StatefulActionNode.onStart() must not return IDLE");
      }
      return newStatus;
    }
    if(prevStatus == NodeStatus.RUNNING)
    {
      NodeStatus newStatus = onRunning();
      if(newStatus == NodeStatus.IDLE)
      {
        throw new LogicError("StatefulActionNode.onRunning() must not return IDLE");
      }
      return newStatus;
    }
    return prevStatus;
  }

  @Override
  protected final void halt()
  {
    haltRequested.set(true);
    if(status() == NodeStatus.RUNNING)
    {
      onHalted();
    }
    resetStatus();
  }
}
