package frc.robot.subsystems;

import edu.wpi.first.wpilibj2.command.SubsystemBase;

/** Stand-in subsystem - replace the console prints with real motor controller calls. */
public class ShooterSubsystem extends SubsystemBase
{
  private boolean atSpeed = false;

  public void spinUp(double targetRpm)
  {
    atSpeed = true;
    System.out.println("[Shooter] spinning up to " + targetRpm + " RPM");
  }

  public void stop()
  {
    atSpeed = false;
    System.out.println("[Shooter] stopped");
  }

  public boolean isAtSpeed()
  {
    return atSpeed;
  }
}
