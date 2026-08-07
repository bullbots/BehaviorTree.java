package org.behaviortree.core;

/** A ConditionNode built from a plain function, avoiding the need to subclass. */
public final class SimpleConditionNode extends ConditionNode
{
  @FunctionalInterface
  public interface TickFunctor
  {
    NodeStatus tick(TreeNode node);
  }

  private final TickFunctor functor;

  public SimpleConditionNode(String name, TickFunctor functor, NodeConfig config)
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
