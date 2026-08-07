package org.behaviortree.core.actions;

import org.behaviortree.core.Blackboard;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.RuntimeError;
import org.behaviortree.core.SyncActionNode;
import org.behaviortree.core.TreeNode;

/**
 * Writes the {@code value} port into the blackboard entry named by {@code output_key}. If
 * {@code value} is itself a blackboard pointer ({@code {src_port}}), copies that entry's type and
 * content across (a "port to port" copy); otherwise stores the literal string, converted to the
 * destination entry's declared type if it already has one.
 */
public class SetBlackboardNode extends SyncActionNode
{
  public SetBlackboardNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("SetBlackboard");
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input("value", "Value to be written into the output_key"),
                     Port.inout("output_key", "Name of the blackboard entry where the "
                                              + "value should be written"));
  }

  @Override
  protected NodeStatus tick()
  {
    String outputKey = getInput("output_key", String.class);
    String valueStr = config().inputPorts.get("value");

    Blackboard.Entry dstEntry = config().blackboard.getEntry(outputKey);
    Object outValue;

    if(TreeNode.isBlackboardPointer(valueStr))
    {
      String inputKey = TreeNode.stripBlackboardPointer(valueStr);
      Blackboard.Entry srcEntry = config().blackboard.getEntry(inputKey);
      if(srcEntry == null)
      {
        throw new RuntimeError("Can't find the port referred by [value]");
      }
      if(dstEntry == null)
      {
        config().blackboard.createEntry(outputKey, srcEntry.info);
        dstEntry = config().blackboard.getEntry(outputKey);
      }
      synchronized(srcEntry.lock)
      {
        outValue = srcEntry.value;
      }
    }
    else
    {
      outValue = valueStr;
    }

    if(outValue == null)
    {
      return NodeStatus.FAILURE;
    }

    if(dstEntry != null && dstEntry.info.type() != String.class && outValue instanceof String s)
    {
      try
      {
        outValue = dstEntry.info.parseString(s);
      }
      catch(RuntimeException e)
      {
        throw new LogicError("Can't convert string [" + s + "] to type ["
                             + dstEntry.info.type().getName() + "]: " + e.getMessage());
      }
    }

    config().blackboard.set(outputKey, outValue);
    return NodeStatus.SUCCESS;
  }
}
