package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;

/** Swaps SUCCESS and FAILURE; RUNNING and SKIPPED pass through unchanged. */
public class InverterNode extends DecoratorNode
{
  public InverterNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Inverter");
  }

  @Override
  protected NodeStatus tick()
  {
    setStatus(NodeStatus.RUNNING);
    NodeStatus childStatus = childNode.executeTick();

    switch(childStatus)
    {
      case SUCCESS:
        resetChild();
        return NodeStatus.FAILURE;
      case FAILURE:
        resetChild();
        return NodeStatus.SUCCESS;
      default:
        return childStatus;
    }
  }
}
