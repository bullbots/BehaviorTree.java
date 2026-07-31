package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.TreeNode;

/**
 * Like {@link SequenceNode}, but on FAILURE it does NOT restart from the first child: it halts
 * every child from the failed index onward and resumes from that same index next time (i.e. it
 * "remembers" progress across a failing child).
 */
public class SequenceWithMemoryNode extends ControlNode
{
  private int currentChildIdx = 0;
  private int skippedCount = 0;

  public SequenceWithMemoryNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("SequenceWithMemory");
  }

  @Override
  protected void halt()
  {
    // Deliberately NOT resetting currentChildIdx here (mirrors upstream BT.CPP).
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    int childrenCount = children.size();

    if(!status().isActive())
    {
      skippedCount = 0;
    }
    setStatus(NodeStatus.RUNNING);

    while(currentChildIdx < childrenCount)
    {
      TreeNode child = children.get(currentChildIdx);
      NodeStatus prevStatus = child.status();
      NodeStatus childStatus = child.executeTick();

      switch(childStatus)
      {
        case RUNNING:
          return childStatus;
        case FAILURE:
          haltChildren(currentChildIdx);
          return childStatus;
        case SUCCESS:
          currentChildIdx++;
          if(requiresWakeUp() && prevStatus == NodeStatus.IDLE
             && currentChildIdx < childrenCount)
          {
            emitWakeUpSignal();
            return NodeStatus.RUNNING;
          }
          break;
        case SKIPPED:
          currentChildIdx++;
          skippedCount++;
          break;
        case IDLE:
          throw new LogicError("[" + name() + "]: A children should not return IDLE");
        default:
          break;
      }
    }

    boolean allChildrenSkipped = (skippedCount == childrenCount);
    if(currentChildIdx == childrenCount)
    {
      resetChildren();
      currentChildIdx = 0;
      skippedCount = 0;
    }
    return allChildrenSkipped ? NodeStatus.SKIPPED : NodeStatus.SUCCESS;
  }
}
