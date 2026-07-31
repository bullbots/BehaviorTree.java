package org.behaviortree.core;

/**
 * A leaf node used to check a condition. Unlike ActionNodes, a ConditionNode should not alter the
 * system or have side effects, and must not return RUNNING.
 */
public abstract class ConditionNode extends TreeNode
{
  protected ConditionNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  @Override
  protected final void halt()
  {
    resetStatus();
  }

  @Override
  public final NodeType type()
  {
    return NodeType.CONDITION;
  }
}
