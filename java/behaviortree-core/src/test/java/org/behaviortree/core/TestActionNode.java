package org.behaviortree.core;

import java.util.function.Function;

/** A leaf action for tests that (unlike SimpleActionNode) is allowed to return RUNNING. */
public final class TestActionNode extends ActionNodeBase
{
  private final Function<TreeNode, NodeStatus> tickFn;

  public TestActionNode(String name, NodeConfig config, Function<TreeNode, NodeStatus> tickFn)
  {
    super(name, config);
    this.tickFn = tickFn;
  }

  @Override
  protected NodeStatus tick()
  {
    return tickFn.apply(this);
  }

  @Override
  protected void halt()
  {
    resetStatus();
  }
}
