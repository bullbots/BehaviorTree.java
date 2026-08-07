package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.TreeNode;

/**
 * Re-ticks every child from the first one on every single tick (unlike {@link SequenceNode},
 * which resumes from where it left off) — this is what makes it "reactive" to changing
 * conditions. FAILURE short-circuits immediately; RUNNING halts every other child and returns
 * immediately; SUCCESS continues to the next child within the same tick.
 */
public class ReactiveSequence extends ControlNode
{
  private static volatile boolean throwIfMultipleRunning = false;
  private int runningChild = -1;

  public ReactiveSequence(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ReactiveSequence");
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
            throw new LogicError("[ReactiveSequence]: only a single child can return RUNNING. "
                                 + "This throw can be disabled with "
                                 + "ReactiveSequence.enableException(false)");
          }
          return NodeStatus.RUNNING;
        }
        case FAILURE:
          resetChildren();
          return NodeStatus.FAILURE;
        case SUCCESS:
          break;
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
    return allSkipped ? NodeStatus.SKIPPED : NodeStatus.SUCCESS;
  }
}
