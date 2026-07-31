package org.behaviortree.core.decorators;

import org.behaviortree.core.DecoratorNode;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.NodeType;
import org.behaviortree.core.PortDirection;
import org.behaviortree.core.PortInfo;
import org.behaviortree.core.PortsList;

/**
 * Wraps an entire nested {@code <BehaviorTree>} with its own child Blackboard. Pure pass-through:
 * the actual port remapping (via {@code _autoremap} or explicit attributes) is applied by the XML
 * parser when it builds the child blackboard, not by this node.
 */
public class SubtreeNode extends DecoratorNode
{
  private String subtreeId = "";

  public SubtreeNode(String name, NodeConfig config)
  {
    super(name, config);
    setRegistrationId("SubTree");
  }

  public static PortsList providedPorts()
  {
    // Built directly (bypassing Port.input's name validation) because a leading underscore is
    // normally reserved and would be rejected there.
    PortInfo port = new PortInfo(PortDirection.INPUT, Boolean.class);
    port.setDefaultValue(false);
    port.setDescription("If true, all the ports with the same name will be remapped");
    PortsList ports = new PortsList();
    ports.put("_autoremap", port);
    return ports;
  }

  public void setSubtreeId(String id)
  {
    this.subtreeId = id;
  }

  public String subtreeId()
  {
    return subtreeId;
  }

  @Override
  public NodeType type()
  {
    return NodeType.SUBTREE;
  }

  @Override
  protected NodeStatus tick()
  {
    NodeStatus prevStatus = status();
    if(prevStatus == NodeStatus.IDLE)
    {
      setStatus(NodeStatus.RUNNING);
    }
    NodeStatus childStatus = childNode.executeTick();
    if(childStatus.isCompleted())
    {
      resetChild();
    }
    return childStatus;
  }
}
