package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.RuntimeError;

/** Retries the child up to {@code num_attempts} times after a FAILURE ({@code -1} = infinite). */
public class RetryNode extends DecoratorNode
{
  public static final String NUM_ATTEMPTS = "num_attempts";

  private int maxAttempts;
  private int tryCount = 0;
  private final boolean readParameterFromPorts;

  public RetryNode(String name, int numAttempts)
  {
    super(name, new NodeConfig());
    this.maxAttempts = numAttempts;
    this.readParameterFromPorts = false;
    setRegistrationId("RetryUntilSuccessful");
  }

  public RetryNode(String name, NodeConfig config)
  {
    super(name, config);
    this.readParameterFromPorts = true;
    setRegistrationId("RetryUntilSuccessful");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Integer.class, NUM_ATTEMPTS,
                                "Execute again a failing child up to N times. Use -1 to "
                                    + "create an infinite loop."));
  }

  @Override
  protected void halt()
  {
    tryCount = 0;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    if(readParameterFromPorts)
    {
      try
      {
        maxAttempts = getInput(NUM_ATTEMPTS, Integer.class);
      }
      catch(RuntimeException e)
      {
        throw new RuntimeError("Missing parameter [" + NUM_ATTEMPTS + "] in RetryNode");
      }
    }

    boolean doLoop = tryCount < maxAttempts || maxAttempts == -1;
    setStatus(NodeStatus.RUNNING);

    while(doLoop)
    {
      NodeStatus prevStatus = childNode.status();
      NodeStatus childStatus = childNode.executeTick();

      switch(childStatus)
      {
        case SUCCESS:
          tryCount = 0;
          resetChild();
          return NodeStatus.SUCCESS;
        case FAILURE:
        {
          tryCount++;
          if(readParameterFromPorts)
          {
            maxAttempts = getInput(NUM_ATTEMPTS, Integer.class);
          }
          doLoop = tryCount < maxAttempts || maxAttempts == -1;
          resetChild();
          if(requiresWakeUp() && prevStatus == NodeStatus.IDLE && doLoop)
          {
            emitWakeUpSignal();
            return NodeStatus.RUNNING;
          }
          break;
        }
        case RUNNING:
          return NodeStatus.RUNNING;
        case SKIPPED:
          resetChild();
          return NodeStatus.SKIPPED;
        case IDLE:
          throw new LogicError("[" + name() + "]: A children should not return IDLE");
        default:
          break;
      }
    }

    tryCount = 0;
    return NodeStatus.FAILURE;
  }
}
