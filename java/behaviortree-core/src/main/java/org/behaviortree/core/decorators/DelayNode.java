package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;

/** Waits {@code delay_msec} milliseconds before ticking the child for the first time. See
 * {@link TimeoutNode} for a note on why this is poll- rather than timer-thread based. */
public class DelayNode extends DecoratorNode
{
  public static final String DELAY_MSEC = "delay_msec";

  private boolean started = false;
  private long deadlineNanos;

  public DelayNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Delay");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Integer.class, DELAY_MSEC,
                                "Tick the child after a few milliseconds"));
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
      int msec = getInput(DELAY_MSEC, Integer.class);
      deadlineNanos = System.nanoTime() + msec * 1_000_000L;
    }

    if(System.nanoTime() < deadlineNanos)
    {
      return NodeStatus.RUNNING;
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
