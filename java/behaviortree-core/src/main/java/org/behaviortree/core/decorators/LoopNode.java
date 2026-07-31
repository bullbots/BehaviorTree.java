package org.behaviortree.core.decorators;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.Optional;
import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;

/**
 * Pops one element at a time from the blackboard entry named by the {@code queue} port (a
 * {@link Deque} or {@link Collection}) into the {@code value} output port and ticks the child.
 * Returns FAILURE if the child fails; otherwise keeps returning RUNNING until the queue is
 * exhausted, at which point it returns the status in {@code if_empty} (SUCCESS by default).
 *
 * <p>This is a simplified port of BT.CPP's templated {@code LoopNode<T>}: it works with any
 * element type (queue elements are read/written as plain objects rather than a compile-time
 * {@code T}), and unlike upstream it does not support a semicolon-separated literal queue
 * written directly in the XML attribute - only a blackboard-provided queue.
 */
public class LoopNode extends DecoratorNode
{
  private boolean childRunning = false;
  private Deque<Object> currentQueue;

  public LoopNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Loop");
  }

  public static PortsList providedPorts()
  {
    return Port.list(
        Port.inout("queue", "Queue of elements, popped one at a time into 'value'"),
        Port.input(NodeStatus.class, "if_empty", NodeStatus.SUCCESS,
                  "Status to return when the queue is empty and the child isn't running"),
        Port.output("value", "The element popped from the queue"));
  }

  @Override
  protected void halt()
  {
    childRunning = false;
    currentQueue = null;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    if(status() == NodeStatus.IDLE)
    {
      childRunning = false;
      currentQueue = null;
    }

    boolean popped = false;
    if(!childRunning)
    {
      if(currentQueue == null)
      {
        currentQueue = readQueue();
      }
      if(!currentQueue.isEmpty())
      {
        Object value = currentQueue.pollFirst();
        setOutput("value", value);
        popped = true;
      }
    }

    if(!popped && !childRunning)
    {
      return tryGetInput("if_empty", NodeStatus.class).orElse(NodeStatus.SUCCESS);
    }

    if(status() == NodeStatus.IDLE)
    {
      setStatus(NodeStatus.RUNNING);
    }
    NodeStatus childStatus = childNode.executeTick();
    childRunning = (childStatus == NodeStatus.RUNNING);
    if(childStatus.isCompleted())
    {
      resetChild();
    }
    return (childStatus == NodeStatus.FAILURE) ? NodeStatus.FAILURE : NodeStatus.RUNNING;
  }

  @SuppressWarnings("unchecked")
  private Deque<Object> readQueue()
  {
    Optional<Object> raw = tryGetInput("queue", Object.class);
    if(raw.isEmpty())
    {
      return new ArrayDeque<>();
    }
    Object value = raw.get();
    if(value instanceof Deque)
    {
      return new ArrayDeque<>((Deque<Object>) value);
    }
    if(value instanceof Collection)
    {
      return new ArrayDeque<>((Collection<Object>) value);
    }
    return new ArrayDeque<>();
  }
}
