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
 * Ticks every not-yet-completed child every tick, always waiting for ALL children to reach a
 * terminal state (unlike {@link ParallelNode}, it never halts children early once a threshold is
 * reached). Once every child is done (or skipped), returns FAILURE if at least {@code
 * max_failures} children failed, otherwise SUCCESS.
 */
public class ParallelAllNode extends ControlNode
{
  private int failureThreshold = 1;
  private final Set<Integer> completedList = new HashSet<>();
  private int failureCount = 0;

  public ParallelAllNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ParallelAll");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Integer.class, "max_failures", 1,
                                "number of failures needed to consider the whole node "
                                    + "as failed"));
  }

  public int failureThreshold()
  {
    return failureThreshold;
  }

  public void setFailureThreshold(int threshold)
  {
    if(threshold < 0)
    {
      failureThreshold = Math.max(children.size() + threshold + 1, 0);
    }
    else
    {
      failureThreshold = threshold;
    }
  }

  @Override
  protected void halt()
  {
    completedList.clear();
    failureCount = 0;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    Integer maxFailures;
    try
    {
      maxFailures = getInput("max_failures", Integer.class);
    }
    catch(RuntimeException e)
    {
      throw new RuntimeError("Missing parameter [max_failures] in ParallelAllNode");
    }
    int childrenCount = children.size();
    setFailureThreshold(maxFailures);

    int skippedCount = 0;

    if(childrenCount < failureThreshold)
    {
      throw new LogicError("Number of children is less than threshold. Can never fail.");
    }

    setStatus(NodeStatus.RUNNING);

    for(int index = 0; index < childrenCount; index++)
    {
      if(completedList.contains(index))
      {
        continue;
      }
      TreeNode child = children.get(index);
      NodeStatus childStatus = child.executeTick();

      switch(childStatus)
      {
        case SUCCESS:
          completedList.add(index);
          break;
        case FAILURE:
          completedList.add(index);
          failureCount++;
          break;
        case RUNNING:
          break;
        case SKIPPED:
          skippedCount++;
          break;
        case IDLE:
          throw new LogicError("[" + name() + "]: A children should not return IDLE");
        default:
          break;
      }
    }

    if(skippedCount == childrenCount)
    {
      return NodeStatus.SKIPPED;
    }
    if(skippedCount + completedList.size() >= childrenCount)
    {
      haltChildren();
      completedList.clear();
      NodeStatus status = (failureCount >= failureThreshold) ? NodeStatus.FAILURE
                                                              : NodeStatus.SUCCESS;
      failureCount = 0;
      return status;
    }
    return NodeStatus.RUNNING;
  }
}
