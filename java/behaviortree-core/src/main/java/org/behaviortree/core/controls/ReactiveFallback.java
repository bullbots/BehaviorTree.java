package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.TreeNode;

/** The reactive, SUCCESS/FAILURE-swapped mirror of {@link ReactiveSequence}. */
public class ReactiveFallback extends ControlNode
{
  private static volatile boolean throwIfMultipleRunning = false;
  private int runningChild = -1;

  public ReactiveFallback(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ReactiveFallback");
  }

  public static void enableException(boolean enable)
  {
    throwIfMultipleRunning = enable;
  }

  @Override
  protected void halt()
  {
    runningChild = -1;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    boolean allSkipped = true;
    if(status() == NodeStatus.IDLE)
    {
      runningChild = -1;
    }
    setStatus(NodeStatus.RUNNING);

    for(int index = 0; index < childrenCount(); index++)
    {
      TreeNode child = children.get(index);
      NodeStatus childStatus = child.executeTick();

      allSkipped &= (childStatus == NodeStatus.SKIPPED);

      switch(childStatus)
      {
        case RUNNING:
        {
          for(int i = 0; i < childrenCount(); i++)
          {
            if(i != index)
            {
              haltChild(i);
            }
          }
          if(runningChild == -1)
          {
            runningChild = index;
          }
          else if(throwIfMultipleRunning && runningChild != index)
          {
            throw new LogicError("[ReactiveFallback]: only a single child can return RUNNING. "
                                 + "This throw can be disabled with "
                                 + "ReactiveFallback.enableException(false)");
          }
          return NodeStatus.RUNNING;
        }
        case FAILURE:
          break;
        case SUCCESS:
          resetChildren();
          return NodeStatus.SUCCESS;
        case SKIPPED:
          haltChild(index);
          break;
        case IDLE:
          throw new LogicError("[" + name() + "]: A children should not return IDLE");
        default:
          break;
      }
    }

    resetChildren();
    return allSkipped ? NodeStatus.SKIPPED : NodeStatus.FAILURE;
  }
}
