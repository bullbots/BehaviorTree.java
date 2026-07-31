package org.behaviortree.core;

/** An action that completes synchronously within a single tick and must never return RUNNING. */
public abstract class SyncActionNode extends ActionNodeBase
{
  protected SyncActionNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  @Override
  public final NodeStatus executeTick()
  {
    NodeStatus status = super.executeTick();
    if(status == NodeStatus.RUNNING)
    {
      throw new LogicError("SyncActionNode MUST never return RUNNING: " + fullPath());
    }
    return status;
  }

  @Override
  protected final void halt()
  {
    resetStatus();
  }
}
