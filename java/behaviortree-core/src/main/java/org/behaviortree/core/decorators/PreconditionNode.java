package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.RuntimeError;
import org.behaviortree.core.scripting.ScriptFunction;
import org.behaviortree.core.scripting.ScriptParser;
import org.behaviortree.core.scripting.ScriptSupport;

/**
 * Evaluates a script condition ({@code if} port) before ticking the child. If true, ticks the
 * child; if false, returns the status in the {@code else} port (FAILURE by default) without
 * ticking the child. Once the child starts (returns RUNNING), the condition is not re-evaluated
 * until the child completes.
 */
public class PreconditionNode extends DecoratorNode
{
  private String script = "";
  private ScriptFunction executor;
  private boolean childrenRunning = false;

  public PreconditionNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Precondition");
    loadExecutor();
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(String.class, "if"),
                     Port.input(NodeStatus.class, "else", NodeStatus.FAILURE,
                                "Return status if condition is false"));
  }

  private void loadExecutor()
  {
    String code = getInput("if", String.class);
    if(code.equals(script) && executor != null)
    {
      return;
    }
    executor = ScriptParser.parse(code);
    script = code;
  }

  @Override
  protected NodeStatus tick()
  {
    loadExecutor();

    NodeStatus elseReturn;
    try
    {
      elseReturn = getInput("else", NodeStatus.class);
    }
    catch(RuntimeException e)
    {
      throw new RuntimeError("Missing parameter [else] in Precondition");
    }

    boolean tickChildren = childrenRunning
                            || (childrenRunning = ScriptSupport.toBoolean(
                                executor.evaluate(config().blackboard, config().enums)));

    if(!tickChildren)
    {
      return elseReturn;
    }

    NodeStatus childStatus = childNode.executeTick();
    if(childStatus.isCompleted())
    {
      resetChild();
      childrenRunning = false;
    }
    return childStatus;
  }
}
