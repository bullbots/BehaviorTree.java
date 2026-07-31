package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;

/** Restarts the child every time it succeeds, forever, until it fails. */
public class KeepRunningUntilFailureNode extends DecoratorNode
{
  public KeepRunningUntilFailureNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("KeepRunningUntilFailure");
  }

  @Override
  protected NodeStatus tick()
  {
    setStatus(NodeStatus.RUNNING);
    NodeStatus childStatus = childNode.executeTick();

    switch(childStatus)
    {
      case FAILURE:
        resetChild();
        return NodeStatus.FAILURE;
      case SUCCESS:
        resetChild();
        return NodeStatus.RUNNING;
      case RUNNING:
        return NodeStatus.RUNNING;
      default:
        return childStatus;
    }
  }
}
