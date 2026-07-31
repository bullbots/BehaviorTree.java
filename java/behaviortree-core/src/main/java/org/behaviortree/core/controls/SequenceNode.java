package org.behaviortree.core.controls;

import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.TreeNode;

/**
 * Ticks children in order; on the first FAILURE it restarts from the first child next time. On
 * SUCCESS it advances to the next child. Returns SUCCESS once every child has succeeded, SKIPPED
 * if every child was skipped, RUNNING while a child is still running.
 *
 * <p>The "async" variant ({@code AsyncSequence}) yields (returns RUNNING) after any child that
 * transitions from IDLE straight to SUCCESS within a single tick, so the tree remains
 * interruptible; the plain {@code Sequence} never yields early.
 */
public class SequenceNode extends ControlNode
{
  private int currentChildIdx = 0;
  private int skippedCount = 0;
  private final boolean asynch;

  public SequenceNode(String name, NodeConfig config)
  {
    this(name, config, false);
  }

  public SequenceNode(String name, NodeConfig config, boolean makeAsync)
  {
    super(name, config);
    this.asynch = makeAsync;
    setRegistrationId(makeAsync ? "AsyncSequence" : "Sequence");
  }

  @Override
  protected void halt()
  {
    currentChildIdx = 0;
    skippedCount = 0;
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
          return NodeStatus.RUNNING;
        case FAILURE:
          resetChildren();
          currentChildIdx = 0;
          return childStatus;
        case SUCCESS:
          currentChildIdx++;
          if(asynch && requiresWakeUp() && prevStatus == NodeStatus.IDLE
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
