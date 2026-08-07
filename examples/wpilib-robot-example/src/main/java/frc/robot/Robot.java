package frc.robot;

import edu.wpi.first.wpilibj.TimedRobot;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;

public class Robot extends TimedRobot
{
  private final RobotContainer robotContainer = new RobotContainer();
  private Command autonomousCommand;

  @Override
  public void robotPeriodic()
  {
    // Drives every scheduled Command, including CommandActionNode's requests and the
    // BehaviorTreeCommand that ticks the autonomous tree.
    CommandScheduler.getInstance().run();
  }

  @Override
  public void autonomousInit()
  {
    autonomousCommand = robotContainer.getAutonomousCommand();
    if(autonomousCommand != null)
    {
      autonomousCommand.schedule();
    }
  }

  @Override
  public void teleopInit()
  {
    if(autonomousCommand != null)
    {
      autonomousCommand.cancel();
    }
  }
}
