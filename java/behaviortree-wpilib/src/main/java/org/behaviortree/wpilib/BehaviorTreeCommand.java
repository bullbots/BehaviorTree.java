package org.behaviortree.wpilib;

import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Subsystem;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Tree;

/**
 * Runs a {@link Tree} as a single WPILib {@link Command}: {@code initialize()} resets the tree to
 * IDLE, {@code execute()} ticks it once per scheduler run, {@code isFinished()} reports true once
 * the root reaches SUCCESS or FAILURE, and {@code end()} halts any still-RUNNING nodes.
 *
 * <p>Each {@code execute()} call also writes the current FPGA timestamp (seconds since the
 * roboRIO booted, from {@link Timer#getFPGATimestamp()}) into the tree's root blackboard under
 * the key {@code "_fpgaTimestamp"}, so scripts and custom nodes can read elapsed time without
 * needing a WPILib dependency of their own.
 */
public class BehaviorTreeCommand extends Command
{
  private static final String FPGA_TIMESTAMP_KEY = "_fpgaTimestamp";

  private final Tree tree;

  public BehaviorTreeCommand(Tree tree, Subsystem... requirements)
  {
    this.tree = tree;
    addRequirements(requirements);
  }

  @Override
  public void initialize()
  {
    tree.rootBlackboard.set(FPGA_TIMESTAMP_KEY, Timer.getFPGATimestamp());
    tree.rootNode.resetStatus();
  }

  @Override
  public void execute()
  {
    tree.rootBlackboard.set(FPGA_TIMESTAMP_KEY, Timer.getFPGATimestamp());
    tree.tickOnce();
  }

  @Override
  public boolean isFinished()
  {
    NodeStatus status = tree.rootNode.status();
    return status == NodeStatus.SUCCESS || status == NodeStatus.FAILURE;
  }

  @Override
  public void end(boolean interrupted)
  {
    tree.haltTree();
  }

  public Tree tree()
  {
    return tree;
  }
}
