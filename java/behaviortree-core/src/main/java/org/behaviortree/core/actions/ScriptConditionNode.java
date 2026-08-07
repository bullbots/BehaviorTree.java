package org.behaviortree.core.actions;

import org.behaviortree.core.ConditionNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.scripting.ScriptFunction;
import org.behaviortree.core.scripting.ScriptParser;
import org.behaviortree.core.scripting.ScriptSupport;

/** Executes a script and returns SUCCESS if the result is true, FAILURE otherwise. */
public class ScriptConditionNode extends ConditionNode
{
  private String script = "";
  private ScriptFunction executor;

  public ScriptConditionNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("ScriptCondition");
    loadExecutor();
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input("code", "Piece of code that can be parsed. Must return "
                                        + "false or true"));
  }

  private void loadExecutor()
  {
    String code = getInput("code", String.class);
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
    Object result = executor.evaluate(config().blackboard, config().enums);
    return ScriptSupport.toBoolean(result) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
