package org.behaviortree.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * An instantiated behavior tree: a root node, its blackboard hierarchy, and the manifests of the
 * node types it uses. Create one via {@link BehaviorTreeFactory}.
 */
public final class Tree
{
  public TreeNode rootNode;
  public Blackboard rootBlackboard;
  public final List<Blackboard> blackboards = new ArrayList<>();
  public final Map<String, TreeNodeManifest> manifests = new LinkedHashMap<>();

  /** Ticks the tree exactly once. This is the method to call from an externally driven periodic
   * loop, e.g. WPILib's {@code robotPeriodic()}. */
  public NodeStatus tickOnce()
  {
    return rootNode.executeTick();
  }

  /** Ticks the tree repeatedly, sleeping {@code sleepMillis} between ticks, until it reaches a
   * terminal status. Intended for standalone use/tests; a real robot should drive the tree from
   * its own periodic loop via {@link #tickOnce()} instead. */
  public NodeStatus tickWhileRunning(long sleepMillis)
  {
    NodeStatus status;
    while((status = tickOnce()) == NodeStatus.RUNNING)
    {
      try
      {
        Thread.sleep(sleepMillis);
      }
      catch(InterruptedException e)
      {
        Thread.currentThread().interrupt();
        return status;
      }
    }
    return status;
  }

  public NodeStatus tickWhileRunning()
  {
    return tickWhileRunning(10);
  }

  /** Halts the tree, interrupting any RUNNING nodes and resetting everything to IDLE. */
  public void haltTree()
  {
    if(rootNode != null)
    {
      rootNode.haltNode();
      rootNode.resetStatus();
    }
  }
}
