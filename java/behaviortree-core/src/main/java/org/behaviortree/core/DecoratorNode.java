package org.behaviortree.core;

/** Base class for nodes with exactly one child, which they may transform, gate, retry, delay, etc. */
public abstract class DecoratorNode extends TreeNode
{
  protected TreeNode childNode;

  protected DecoratorNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  public void setChild(TreeNode child)
  {
    if(childNode != null)
    {
      throw new BehaviorTreeException("Decorator [" + name() + "] already has a child assigned");
    }
    childNode = child;
  }

  public TreeNode child()
  {
    return childNode;
  }

  @Override
  public NodeType type()
  {
    return NodeType.DECORATOR;
  }

  @Override
  protected void halt()
  {
    resetChild();
    resetStatus();
  }

  /** Halts (if RUNNING) and resets the child to IDLE. */
  protected final void resetChild()
  {
    if(childNode == null)
    {
      return;
    }
    if(childNode.status() == NodeStatus.RUNNING)
    {
      childNode.haltNode();
    }
    childNode.resetStatus();
  }

  protected final void haltChild()
  {
    resetChild();
  }

  @Override
  public NodeStatus executeTick()
  {
    NodeStatus status = super.executeTick();
    if(childNode != null)
    {
      NodeStatus childStatus = childNode.status();
      if(childStatus == NodeStatus.SUCCESS || childStatus == NodeStatus.FAILURE)
      {
        childNode.resetStatus();
      }
    }
    return status;
  }
}
