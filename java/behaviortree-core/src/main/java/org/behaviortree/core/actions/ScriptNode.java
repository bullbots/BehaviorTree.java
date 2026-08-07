package org.behaviortree.core.actions;

import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.SyncActionNode;
import org.behaviortree.core.scripting.ScriptFunction;
import org.behaviortree.core.scripting.ScriptParser;

/**
 * Executes a piece of scripting-language code to set or modify blackboard entries, e.g.
 * {@code <Script code="A:=42; B:=3.14" />}. Always returns SUCCESS.
 */
public class ScriptNode extends SyncActionNode
{
  private String script = "";
  private ScriptFunction executor;

  public ScriptNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("Script");
    loadExecutor();
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input(String.class, "code", "Piece of code that can be parsed"));
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
    executor.evaluate(config().blackboard, config().enums);
    return NodeStatus.SUCCESS;
  }
}
