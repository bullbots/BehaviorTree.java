package org.behaviortree.wpilib;

import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.StringPublisher;
import java.util.ArrayList;
import java.util.List;
import org.behaviortree.core.ControlNode;
import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.Tree;
import org.behaviortree.core.TreeNode;

/**
 * Publishes the live status of every node in a {@link Tree} to a NetworkTables table, one string
 * entry per node keyed by its full path (e.g. {@code "root/Sequence/Intake"} -> {@code "RUNNING"}).
 * This is the closest FRC-idiomatic equivalent to BT.CPP's Groot2 live-monitoring publisher (which
 * relies on ZeroMQ and isn't a typical dependency in FRC robot code) - point a
 * Shuffleboard/Elastic/AdvantageScope NetworkTables view at the table to watch the tree run.
 *
 * <pre>{@code
 * Tree tree = factory.createTreeFromFile(path);
 * NTBehaviorTreeLogger logger = new NTBehaviorTreeLogger(tree,
 *     NetworkTableInstance.getDefault().getTable("BehaviorTree"));
 * // ... later, when done with the tree:
 * logger.close();
 * }</pre>
 */
public final class NTBehaviorTreeLogger implements AutoCloseable
{
  private final List<TreeNode.Subscription> subscriptions = new ArrayList<>();
  private final List<StringPublisher> publishers = new ArrayList<>();

  public NTBehaviorTreeLogger(Tree tree, NetworkTable table)
  {
    if(tree.rootNode != null)
    {
      attach(tree.rootNode, table);
    }
  }

  private void attach(TreeNode node, NetworkTable table)
  {
    StringPublisher publisher = table.getStringTopic(node.fullPath()).publish();
    publisher.set(node.status().toString());
    publishers.add(publisher);
    subscriptions.add(
        node.subscribeToStatusChange((time, n, prev, next) -> publisher.set(next.toString())));

    if(node instanceof ControlNode control)
    {
      for(TreeNode child : control.children())
      {
        attach(child, table);
      }
    }
    else if(node instanceof DecoratorNode decorator && decorator.child() != null)
    {
      attach(decorator.child(), table);
    }
  }

  @Override
  public void close()
  {
    for(TreeNode.Subscription s : subscriptions)
    {
      s.close();
    }
    subscriptions.clear();
    for(StringPublisher p : publishers)
    {
      p.close();
    }
    publishers.clear();
  }
}
