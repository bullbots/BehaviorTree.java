package org.behaviortree.core.decorators;

import org.behaviortree.core.Blackboard;
import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.TreeNode;

/**
 * Ticks the child only if the blackboard entry named by the {@code entry} port has been written
 * since the last tick (comparing sequence numbers); otherwise returns {@code ifNotUpdated}
 * without ticking the child. Two ready-made registrations wrap this with different defaults:
 * {@code SkipUnlessUpdated} (SKIPPED) and {@code WaitValueUpdate} (RUNNING).
 */
public class EntryUpdatedDecorator extends DecoratorNode
{
  private long sequenceId = 0;
  private final String entryKey;
  private boolean stillExecutingChild = false;
  private final NodeStatus ifNotUpdated;

  public EntryUpdatedDecorator(String name, NodeConfig config, NodeStatus ifNotUpdated)
  {
    super(name, config);
    this.ifNotUpdated = ifNotUpdated;
    String raw = config.inputPorts.get("entry");
    if(raw == null || raw.isEmpty())
    {
      throw new LogicError("Missing port 'entry' in " + name);
    }
    this.entryKey = TreeNode.isBlackboardPointer(raw) ? TreeNode.stripBlackboardPointer(raw)
                                                       : raw;
  }

  public static PortsList providedPorts()
  {
    return Port.list(Port.input("entry", "Entry to check"));
  }

  @Override
  protected NodeStatus tick()
  {
    if(stillExecutingChild)
    {
      NodeStatus status = childNode.executeTick();
      stillExecutingChild = (status == NodeStatus.RUNNING);
      return status;
    }

    Blackboard.Entry entry = config().blackboard.getEntry(entryKey);
    if(entry == null)
    {
      return ifNotUpdated;
    }
    synchronized(entry.lock)
    {
      long currentId = entry.sequenceId;
      long previousId = sequenceId;
      sequenceId = currentId;
      if(previousId == currentId)
      {
        return ifNotUpdated;
      }
    }

    NodeStatus status = childNode.executeTick();
    stillExecutingChild = (status == NodeStatus.RUNNING);
    return status;
  }

  @Override
  protected void halt()
  {
    stillExecutingChild = false;
    super.halt();
  }
}
