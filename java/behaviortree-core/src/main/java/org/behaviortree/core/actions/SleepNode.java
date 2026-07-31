package org.behaviortree.core.actions;

import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.StatefulActionNode;

/** Sleeps for {@code msec} milliseconds, then returns SUCCESS. See also the {@code Delay}
 * decorator. Poll-based (checked once per tick), matching how a tree is ticked from an
 * externally driven periodic loop. */
public class SleepNode extends StatefulActionNode
{
  private long deadlineNanos;

  public SleepNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Sleep");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Integer.class, "msec"));
  }

  @Override
  public NodeStatus onStart()
  {
    int msec = getInput("msec", Integer.class);
    if(msec <= 0)
    {
      return NodeStatus.SUCCESS;
    }
    deadlineNanos = System.nanoTime() + msec * 1_000_000L;
    return NodeStatus.RUNNING;
  }

  @Override
  public NodeStatus onRunning()
  {
    return System.nanoTime() >= deadlineNanos ? NodeStatus.SUCCESS : NodeStatus.RUNNING;
  }

  @Override
  public void onHalted()
  {
    // nothing to clean up: no background timer is used
  }
}
