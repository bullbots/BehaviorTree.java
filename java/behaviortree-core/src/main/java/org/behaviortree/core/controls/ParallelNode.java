package org.behaviortree.core.controls;

import java.util.HashSet;
import java.util.Set;
import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.RuntimeError;
import org.behaviortree.core.TreeNode;

/**
 * Ticks every not-yet-completed child every tick (true concurrency within one thread - the only
 * built-in control node that can have more than one child RUNNING at once). Completes as soon as
 * either threshold is reached, halting any children still running. Thresholds follow Python-style
 * negative indexing: -1 means "all children".
 */
public class ParallelNode extends ControlNode
{
  public static final String THRESHOLD_SUCCESS = "success_count";
  public static final String THRESHOLD_FAILURE = "failure_count";

  private int successThreshold = -1;
  private int failureThreshold = 1;
  private final boolean readParametersFromPorts;

  private final Set<Integer> completedList = new HashSet<>();
  private int successCount = 0;
  private int failureCount = 0;

  public ParallelNode(String name)
  {
    super(name, new NodeConfig());
    this.readParametersFromPorts = false;
    setRegistrationId("Parallel");
  }

  public ParallelNode(String name, NodeConfig config)
  {
    super(name, config);
    this.readParametersFromPorts = true;
    setRegistrationId("Parallel");
  }

  public static PortsList providedPorts()
  {
    return Port.list(
        Port.input(Integer.class, THRESHOLD_SUCCESS, -1,
                   "number of children that need to succeed to trigger a SUCCESS"),
        Port.input(Integer.class, THRESHOLD_FAILURE, 1,
                   "number of children that need to fail to trigger a FAILURE"));
  }

  @Override
  protected void halt()
  {
    clear();
    super.halt();
  }

  private void clear()
  {
    completedList.clear();
    successCount = 0;
    failureCount = 0;
  }

  public int successThreshold()
  {
    if(successThreshold < 0)
    {
      return Math.max(children.size() + successThreshold + 1, 0);
    }
    return successThreshold;
  }

  public int failureThreshold()
  {
    if(failureThreshold < 0)
    {
      return Math.max(children.size() + failureThreshold + 1, 0);
    }
    return failureThreshold;
  }

  public void setSuccessThreshold(int threshold)
  {
    this.successThreshold = threshold;
  }

  public void setFailureThreshold(int threshold)
  {
    this.failureThreshold = threshold;
  }

  @Override
  protected NodeStatus tick()
  {
    if(readParametersFromPorts)
    {
      try
      {
        successThreshold = getInput(THRESHOLD_SUCCESS, Integer.class);
        failureThreshold = getInput(THRESHOLD_FAILURE, Integer.class);
      }
      catch(RuntimeException e)
      {
        throw new RuntimeError("Missing parameter [" + THRESHOLD_SUCCESS + "] or ["
                               + THRESHOLD_FAILURE + "] in ParallelNode");
      }
    }

    int childrenCount = children.size();

    if(childrenCount < successThreshold())
    {
      throw new LogicError("Number of children is less than threshold. Can never succeed.");
    }
    if(childrenCount < failureThreshold())
    {
      throw new LogicError("Number of children is less than threshold. Can never fail.");
    }

    setStatus(NodeStatus.RUNNING);

    int skippedCount = 0;

    for(int i = 0; i < childrenCount; i++)
    {
      if(!completedList.contains(i))
      {
        TreeNode child = children.get(i);
        NodeStatus childStatus = child.executeTick();

        switch(childStatus)
        {
          case SKIPPED:
            skippedCount++;
            break;
          case SUCCESS:
            completedList.add(i);
            successCount++;
            break;
          case FAILURE:
            completedList.add(i);
            failureCount++;
            break;
          case RUNNING:
            break;
          case IDLE:
            throw new LogicError("[" + name() + "]: A children should not return IDLE");
          default:
            break;
        }
      }

      int requiredSuccessCount = successThreshold();

      if(successCount >= requiredSuccessCount
         || (successThreshold < 0 && (successCount + skippedCount) >= requiredSuccessCount))
      {
        clear();
        resetChildren();
        return NodeStatus.SUCCESS;
      }

      if(((childrenCount - failureCount) < requiredSuccessCount)
         || (failureCount == failureThreshold()))
      {
        clear();
        resetChildren();
        return NodeStatus.FAILURE;
      }
    }

    return (skippedCount == childrenCount) ? NodeStatus.SKIPPED : NodeStatus.RUNNING;
  }
}
