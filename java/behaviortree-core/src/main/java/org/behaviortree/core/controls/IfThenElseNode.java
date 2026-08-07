package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.TreeNode;

/**
 * Requires 2 or 3 children: condition, then-branch, optional else-branch. Not reactive: once the
 * condition has committed to a branch, the condition is not re-evaluated until that branch
 * completes.
 */
public class IfThenElseNode extends ControlNode
{
  private int childIdx = 0;

  public IfThenElseNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("IfThenElse");
  }

  @Override
  protected void halt()
  {
    childIdx = 0;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    int childrenCount = children.size();
    if(childrenCount != 2 && childrenCount != 3)
    {
      throw new LogicError("IfThenElseNode must have either 2 or 3 children");
    }

    setStatus(NodeStatus.RUNNING);

    if(childIdx == 0)
    {
      NodeStatus conditionStatus = children.get(0).executeTick();

      if(conditionStatus == NodeStatus.RUNNING)
      {
        return conditionStatus;
      }
      if(conditionStatus == NodeStatus.SUCCESS)
      {
        childIdx = 1;
      }
      else if(conditionStatus == NodeStatus.FAILURE)
      {
        if(childrenCount == 3)
        {
          childIdx = 2;
        }
        else
        {
          return conditionStatus;
        }
      }
    }

    if(childIdx > 0)
    {
      TreeNode child = children.get(childIdx);
      NodeStatus status = child.executeTick();
      if(status == NodeStatus.RUNNING)
      {
        return NodeStatus.RUNNING;
      }
      resetChildren();
      childIdx = 0;
      return status;
    }

    throw new LogicError("Something unexpected happened in IfThenElseNode");
  }
}
