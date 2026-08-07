package frc.robot.commands;

import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.subsystems.ShooterSubsystem;

/** Spins up the shooter and finishes once it reports at-speed - a stand-in for a real
 * flywheel-velocity check. */
public class ShootCommand extends Command
{
  private static final double TARGET_RPM = 3000.0;
  private static final double SPIN_UP_SECONDS = 1.0;

  private final ShooterSubsystem shooter;
  private final Timer timer = new Timer();

  public ShootCommand(ShooterSubsystem shooter)
  {
    this.shooter = shooter;
    addRequirements(shooter);
  }

  @Override
  public void initialize()
  {
    timer.restart();
    shooter.spinUp(TARGET_RPM);
  }

  @Override
  public boolean isFinished()
  {
    return timer.hasElapsed(SPIN_UP_SECONDS);
  }

  @Override
  public void end(boolean interrupted)
  {
    shooter.stop();
  }
}
