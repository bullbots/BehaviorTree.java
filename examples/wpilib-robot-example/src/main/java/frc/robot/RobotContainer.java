package frc.robot;

import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.Filesystem;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.commands.IntakeCommand;
import frc.robot.commands.ShootCommand;
import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.ShooterSubsystem;
import java.nio.file.Path;
import org.behaviortree.core.BehaviorTreeFactory;
import org.behaviortree.core.Tree;
import org.behaviortree.wpilib.BehaviorTreeCommand;
import org.behaviortree.wpilib.NTBehaviorTreeLogger;
import org.behaviortree.wpilib.WpilibNodes;

/**
 * Wires up subsystems, registers behavior tree leaf actions that wrap their Commands, and loads
 * the autonomous routine from {@code src/main/deploy/autonomous.xml}.
 */
public class RobotContainer
{
  private final IntakeSubsystem intakeSubsystem = new IntakeSubsystem();
  private final ShooterSubsystem shooterSubsystem = new ShooterSubsystem();

  private final BehaviorTreeFactory factory = new BehaviorTreeFactory();
  private final Tree autonomousTree;

  public RobotContainer()
  {
    // Any node ID used in autonomous.xml must be registered here first.
    WpilibNodes.registerCommandAction(factory, "Intake",
                                      () -> new IntakeCommand(intakeSubsystem));
    WpilibNodes.registerCommandAction(factory, "Shoot",
                                      () -> new ShootCommand(shooterSubsystem));

    autonomousTree = factory.createTreeFromFile(
        Path.of(Filesystem.getDeployDirectory().toString(), "autonomous.xml"));

    // Optional: watch the tree run live on Shuffleboard/Elastic/AdvantageScope by
    // pointing a NetworkTables view at the "BehaviorTree" table.
    new NTBehaviorTreeLogger(autonomousTree,
        NetworkTableInstance.getDefault().getTable("BehaviorTree"));
  }

  public Command getAutonomousCommand()
  {
    return new BehaviorTreeCommand(autonomousTree, intakeSubsystem, shooterSubsystem);
  }
}
