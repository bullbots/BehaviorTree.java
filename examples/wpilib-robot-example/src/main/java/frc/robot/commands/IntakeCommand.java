package frc.robot.commands;

import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.subsystems.IntakeSubsystem;

/** Runs the intake for a fixed duration, then finishes - a stand-in for a real "intake until
 * game piece detected" command. This is an ordinary WPILib Command; {@link
 * org.behaviortree.wpilib.CommandActionNode} (used via {@code WpilibNodes.registerCommandAction}
 * in RobotContainer) is what makes it usable as a behavior tree leaf, with no changes needed
 * here. */
public class IntakeCommand extends Command
{
  private static final double DURATION_SECONDS = 1.5;

  private final IntakeSubsystem intake;
  private final Timer timer = new Timer();

  public IntakeCommand(IntakeSubsystem intake)
  {
    this.intake = intake;
    addRequirements(intake);
  }

  @Override
  public void initialize()
  {
    timer.restart();
    intake.start();
  }

  @Override
  public boolean isFinished()
  {
    return timer.hasElapsed(DURATION_SECONDS);
  }

  @Override
  public void end(boolean interrupted)
  {
    intake.stop();
  }
}
