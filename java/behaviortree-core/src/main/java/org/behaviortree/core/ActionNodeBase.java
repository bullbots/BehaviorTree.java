package org.behaviortree.core;

/** Base class for every action node (a leaf that performs a task and may run asynchronously). */
public abstract class ActionNodeBase extends TreeNode
{
  protected ActionNodeBase(String name, NodeConfig config)
  {
    super(name, config);
  }

  @Override
  public final NodeType type()
  {
    return NodeType.ACTION;
  }
}
