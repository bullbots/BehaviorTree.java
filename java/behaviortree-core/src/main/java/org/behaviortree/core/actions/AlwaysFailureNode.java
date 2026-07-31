package org.behaviortree.core.actions;

import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.SyncActionNode;

/** Always returns FAILURE. Useful as a placeholder or a no-op branch. */
public class AlwaysFailureNode extends SyncActionNode
{
  public AlwaysFailureNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("AlwaysFailure");
  }

  @Override
  protected NodeStatus tick()
  {
    return NodeStatus.FAILURE;
  }
}
