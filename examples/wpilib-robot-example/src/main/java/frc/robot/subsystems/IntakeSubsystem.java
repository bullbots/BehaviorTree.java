package frc.robot.subsystems;

import edu.wpi.first.wpilibj2.command.SubsystemBase;

/** Stand-in subsystem - replace the console prints with real motor controller calls. */
public class IntakeSubsystem extends SubsystemBase
{
  private boolean running = false;

  public void start()
  {
    running = true;
    System.out.println("[Intake] running");
  }

  public void stop()
  {
    running = false;
    System.out.println("[Intake] stopped");
  }

  public boolean isRunning()
  {
    return running;
  }
}
