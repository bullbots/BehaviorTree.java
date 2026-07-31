package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;

/** Ticks the child only once. After it completes, returns SKIPPED forever (if {@code then_skip}
 * is true, the default) or replays the same terminal status forever (if false). */
public class RunOnceNode extends DecoratorNode
{
  private boolean alreadyTicked = false;
  private NodeStatus returnedStatus = NodeStatus.IDLE;

  public RunOnceNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("RunOnce");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Boolean.class, "then_skip", true,
                                "If true, skip after the first execution, otherwise return "
                                    + "the same NodeStatus returned once by the child."));
  }

  @Override
  protected NodeStatus tick()
  {
    boolean skip = tryGetInput("then_skip", Boolean.class).orElse(true);

    if(alreadyTicked)
    {
      return skip ? NodeStatus.SKIPPED : returnedStatus;
    }

    setStatus(NodeStatus.RUNNING);
    NodeStatus status = childNode.executeTick();

    if(status.isCompleted())
    {
      alreadyTicked = true;
      returnedStatus = status;
      resetChild();
    }
    return status;
  }
}
