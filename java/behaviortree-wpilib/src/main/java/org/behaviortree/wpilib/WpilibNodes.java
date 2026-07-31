package org.behaviortree.wpilib;

import edu.wpi.first.wpilibj2.command.Command;
import java.util.function.Supplier;
import org.behaviortree.core.BehaviorTreeFactory;
import org.behaviortree.core.NodeType;
import org.behaviortree.core.PortsList;

/** Convenience registration helpers for the WPILib integration layer. */
public final class WpilibNodes
{
  private WpilibNodes()
  {}

  /** Registers a leaf action node called {@code id} that runs {@code commandSupplier.get()}
   * through {@link CommandActionNode} each time it starts. */
  public static void registerCommandAction(BehaviorTreeFactory factory, String id,
                                           Supplier<Command> commandSupplier)
  {
    registerCommandAction(factory, id, new PortsList(), commandSupplier);
  }

  public static void registerCommandAction(BehaviorTreeFactory factory, String id,
                                           PortsList ports, Supplier<Command> commandSupplier)
  {
    factory.registerNodeType(id, ports, NodeType.ACTION,
                             (name, config) -> new CommandActionNode(name, config,
                                                                     commandSupplier));
  }
}
