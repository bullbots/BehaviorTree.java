package org.behaviortree.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Base class for nodes with any number of children; determines the order and conditions under
 * which they are ticked. */
public abstract class ControlNode extends TreeNode
{
  protected final List<TreeNode> children = new ArrayList<>();

  protected ControlNode(String name, NodeConfig config)
  {
    super(name, config);
  }

  public void addChild(TreeNode child)
  {
    children.add(child);
  }

  public int childrenCount()
  {
    return children.size();
  }

  public List<TreeNode> children()
  {
    return Collections.unmodifiableList(children);
  }

  public TreeNode child(int index)
  {
    return children.get(index);
  }

  @Override
  public final NodeType type()
  {
    return NodeType.CONTROL;
  }

  @Override
  protected void halt()
  {
    resetChildren();
    resetStatus();
  }

  /** Halts (if RUNNING) and resets a single child to IDLE. */
  protected final void haltChild(int i)
  {
    TreeNode c = children.get(i);
    if(c.status() == NodeStatus.RUNNING)
    {
      c.haltNode();
    }
    c.resetStatus();
  }

  /** Sets the status of every child to IDLE, halting any that are RUNNING. */
  protected final void resetChildren()
  {
    for(int i = 0; i < children.size(); i++)
    {
      haltChild(i);
    }
  }

  protected final void haltChildren()
  {
    resetChildren();
  }

  /** Halts/resets every child from index {@code from} (inclusive) to the end. */
  protected final void haltChildren(int from)
  {
    for(int i = from; i < children.size(); i++)
    {
      haltChild(i);
    }
  }
}
