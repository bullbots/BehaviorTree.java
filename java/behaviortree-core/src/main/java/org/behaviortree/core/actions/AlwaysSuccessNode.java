package org.behaviortree.core.actions;

import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.SyncActionNode;

/** Always returns SUCCESS. Useful as a placeholder or a no-op branch. */
public class AlwaysSuccessNode extends SyncActionNode
{
  public AlwaysSuccessNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("AlwaysSuccess");
  }

  @Override
  protected NodeStatus tick()
  {
    return NodeStatus.SUCCESS;
  }
}
