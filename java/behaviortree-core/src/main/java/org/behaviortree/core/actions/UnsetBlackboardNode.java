package org.behaviortree.core.actions;

import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.SyncActionNode;

/** Removes an entry from the blackboard and returns SUCCESS. */
public class UnsetBlackboardNode extends SyncActionNode
{
  public UnsetBlackboardNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("UnsetBlackboard");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(String.class, "key", "Key of the entry to remove"));
  }

  @Override
  protected NodeStatus tick()
  {
    String key = getInput("key", String.class);
    config().blackboard.unset(key);
    return NodeStatus.SUCCESS;
  }
}
