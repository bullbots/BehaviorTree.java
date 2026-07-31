package org.behaviortree.wpilib;

import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import java.util.function.Supplier;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.StatefulActionNode;

/**
 * Wraps a WPILib {@link Command} as a behavior tree leaf action. The command is scheduled through
 * {@link CommandScheduler} (so it participates in the normal subsystem-requirement/interrupt
 * rules) when the node starts, polled each tick, and cancelled if the node is halted.
 *
 * <p>A fresh {@link Command} instance is requested from {@code commandSupplier} every time the
 * node transitions from IDLE, since a WPILib {@code Command} is generally not meant to be
 * re-scheduled after it has ended.
 *
 * <pre>{@code
 * factory.registerNodeType("Intake", PortsList.of(), NodeType.ACTION,
 *     (name, config) -> new CommandActionNode(name, config, () -> new IntakeCommand(intakeSubsystem)));
 * }</pre>
 */
public class CommandActionNode extends StatefulActionNode
{
  private final Supplier<Command> commandSupplier;
  private Command command;

  public CommandActionNode(String name, NodeConfig config, Supplier<Command> commandSupplier)
  {
    super(name, config);
    this.commandSupplier = commandSupplier;
  }

  @Override
  public NodeStatus onStart()
  {
    command = commandSupplier.get();
    CommandScheduler.getInstance().schedule(command);
    return NodeStatus.RUNNING;
  }

  @Override
  public NodeStatus onRunning()
  {
    if(CommandScheduler.getInstance().isScheduled(command))
    {
      return NodeStatus.RUNNING;
    }
    // The command is no longer scheduled: it either finished on its own or was interrupted by
    // something outside this node's control (e.g. a conflicting requirement). Either way there
    // is nothing left for this node to do.
    return NodeStatus.SUCCESS;
  }

  @Override
  public void onHalted()
  {
    if(command != null)
    {
      CommandScheduler.getInstance().cancel(command);
    }
  }
}
