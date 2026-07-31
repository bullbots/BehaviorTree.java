package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;

/** Converts a completed child (SUCCESS or FAILURE) into FAILURE; RUNNING/SKIPPED pass through. */
public class ForceFailureNode extends DecoratorNode
{
  public ForceFailureNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ForceFailure");
  }

  @Override
  protected NodeStatus tick()
  {
    setStatus(NodeStatus.RUNNING);
    NodeStatus childStatus = childNode.executeTick();
    if(childStatus.isCompleted())
    {
      resetChild();
      return NodeStatus.FAILURE;
    }
    return childStatus;
  }
}
