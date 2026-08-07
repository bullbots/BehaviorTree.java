package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;

/** Converts a completed child (SUCCESS or FAILURE) into SUCCESS; RUNNING/SKIPPED pass through. */
public class ForceSuccessNode extends DecoratorNode
{
  public ForceSuccessNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ForceSuccess");
  }

  @Override
  protected NodeStatus tick()
  {
    setStatus(NodeStatus.RUNNING);
    NodeStatus childStatus = childNode.executeTick();
    if(childStatus.isCompleted())
    {
      resetChild();
      return NodeStatus.SUCCESS;
    }
    return childStatus;
  }
}
