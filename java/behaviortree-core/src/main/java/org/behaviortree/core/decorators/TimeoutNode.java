package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;

/**
 * Fails the child (halting it) if it hasn't completed within {@code msec} milliseconds ({@code 0}
 * = no timeout). Unlike upstream BT.CPP's timer-thread implementation, this is poll-based:
 * the deadline is checked once per {@link #tick()} call rather than from a background thread,
 * matching how a tree is ticked from an externally driven periodic loop (e.g. WPILib's
 * {@code robotPeriodic()}) rather than a free-running sleep loop.
 */
public class TimeoutNode extends DecoratorNode
{
  public static final String MSEC = "msec";

  private boolean started = false;
  private long deadlineNanos = Long.MAX_VALUE;

  public TimeoutNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Timeout");
  }

  public static PortsList providedPorts()
  {
    return Port.list(
        Port.input(Integer.class, MSEC, "After a certain amount of time, halt() the child if "
                                        + "it's still running. 0 means no timeout."));
  }

  @Override
  protected void halt()
  {
    started = false;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    if(!started)
    {
      started = true;
      setStatus(NodeStatus.RUNNING);
      int msec = getInput(MSEC, Integer.class);
      deadlineNanos = msec > 0 ? System.nanoTime() + msec * 1_000_000L : Long.MAX_VALUE;
    }

    if(System.nanoTime() >= deadlineNanos)
    {
      started = false;
      haltChild();
      return NodeStatus.FAILURE;
    }

    NodeStatus childStatus = childNode.executeTick();
    if(childStatus.isCompleted())
    {
      started = false;
      resetChild();
    }
    return childStatus;
  }
}
