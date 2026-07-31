package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.RuntimeError;

/** Repeats the child up to {@code num_cycles} times as long as it keeps succeeding ({@code -1} =
 * infinite); stops immediately on the first FAILURE. */
public class RepeatNode extends DecoratorNode
{
  public static final String NUM_CYCLES = "num_cycles";

  private int numCycles;
  private int repeatCount = 0;
  private final boolean readParameterFromPorts;

  public RepeatNode(String name, int numCycles)
  {
    super(name, new NodeConfig());
    this.numCycles = numCycles;
    this.readParameterFromPorts = false;
    setRegistrationId("Repeat");
  }

  public RepeatNode(String name, NodeConfig config)
  {
    super(name, config);
    this.readParameterFromPorts = true;
    setRegistrationId("Repeat");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(Integer.class, NUM_CYCLES,
                                "Repeat a successful child up to N times. Use -1 to create "
                                    + "an infinite loop."));
  }

  @Override
  protected void halt()
  {
    repeatCount = 0;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    if(readParameterFromPorts)
    {
      try
      {
        numCycles = getInput(NUM_CYCLES, Integer.class);
      }
      catch(RuntimeException e)
      {
        throw new RuntimeError("Missing parameter [" + NUM_CYCLES + "] in RepeatNode");
      }
    }

    boolean doLoop = repeatCount < numCycles || numCycles == -1;
    setStatus(NodeStatus.RUNNING);

    while(doLoop)
    {
      NodeStatus prevStatus = childNode.status();
      NodeStatus childStatus = childNode.executeTick();

      switch(childStatus)
      {
        case SUCCESS:
        {
          repeatCount++;
          doLoop = repeatCount < numCycles || numCycles == -1;
          resetChild();
          if(requiresWakeUp() && prevStatus == NodeStatus.IDLE && doLoop)
          {
            emitWakeUpSignal();
            return NodeStatus.RUNNING;
          }
          break;
        }
        case FAILURE:
          repeatCount = 0;
          resetChild();
          return NodeStatus.FAILURE;
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

    repeatCount = 0;
    return NodeStatus.SUCCESS;
  }
}
