package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;

/**
 * The reactive version of {@link IfThenElseNode}: the condition (child 0) is re-ticked on every
 * single tick, unconditionally, and switches branches (halting the other) if it changes.
 */
public class WhileDoElseNode extends ControlNode
{
  public WhileDoElseNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("WhileDoElse");
  }

  @Override
  protected NodeStatus tick()
  {
    int childrenCount = children.size();
    if(childrenCount != 2 && childrenCount != 3)
    {
      throw new LogicError("WhileDoElseNode must have either 2 or 3 children");
    }

    setStatus(NodeStatus.RUNNING);

    NodeStatus conditionStatus = children.get(0).executeTick();

    if(conditionStatus == NodeStatus.RUNNING)
    {
      return conditionStatus;
    }

    NodeStatus status = NodeStatus.IDLE;

    if(conditionStatus == NodeStatus.SUCCESS)
    {
      if(childrenCount == 3)
      {
        haltChild(2);
      }
      status = children.get(1).executeTick();
    }
    else if(conditionStatus == NodeStatus.FAILURE)
    {
      if(childrenCount == 3)
      {
        haltChild(1);
        status = children.get(2).executeTick();
      }
      else
      {
        status = NodeStatus.FAILURE;
      }
    }

    if(status == NodeStatus.RUNNING)
    {
      return NodeStatus.RUNNING;
    }
    resetChildren();
    return status;
  }
}
