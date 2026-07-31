package org.behaviortree.core;

/** A SyncActionNode built from a plain function, avoiding the need to subclass. */
public final class SimpleActionNode extends SyncActionNode
{
  @FunctionalInterface
  public interface TickFunctor
  {
    NodeStatus tick(TreeNode node);
  }

  private final TickFunctor functor;

  public SimpleActionNode(String name, TickFunctor functor, NodeConfig config)
  {
    super(name, config);
    this.functor = functor;
  }

  @Override
  protected NodeStatus tick()
  {
    return functor.tick(this);
  }
}
