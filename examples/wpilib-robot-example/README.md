# WPILib robot example (Option 1: Gradle composite build)

A minimal reference showing how to consume `behaviortree-core`/`behaviortree-wpilib` from an FRC
robot project with **no Maven hosting required** - `settings.gradle` pulls the library in as
source via Gradle's `includeBuild`, straight from this repo's [`java/`](../../java) directory.

This is a reference to read and copy pieces from, not a project meant to be built standing alone
here: it has no Gradle wrapper of its own (a real WPILib project already has one from the project
generator), and `build.gradle` is intentionally trimmed to highlight the two things that matter
rather than trying to be a pixel-perfect current-season GradleRIO template.

## What to actually do in your own robot project

1. **Get the library into your workspace.** Either clone/submodule this repo somewhere your robot
   project can reach, e.g.:
   ```bash
   cd your-robot-project
   git submodule add https://github.com/carterspenner/BehaviorTree.CPP vendor/BehaviorTree.CPP
   ```

2. **Add one line to your `settings.gradle`** (see this example's `settings.gradle`):
   ```groovy
   includeBuild('vendor/BehaviorTree.CPP/java')
   ```

3. **Add two lines to your `build.gradle`'s `dependencies { }` block** (see the block marked
   `BEHAVIORTREE` in this example's `build.gradle`):
   ```groovy
   implementation 'org.behaviortree:behaviortree-core:4.10.0'
   implementation 'org.behaviortree:behaviortree-wpilib:4.10.0'
   ```
   Drop the second line if you only want the pure-Java engine with no WPILib integration classes.

4. **Set `wpilibVersion` to match your season** in `vendor/BehaviorTree.CPP/java/gradle.properties`
   (it should match the year/version of the `edu.wpi.first.GradleRIO` plugin your project already
   uses) - `behaviortree-wpilib` compiles against that version's WPILib jars.

That's it; `./gradlew build`/`./gradlew deploy` work exactly as before, the library's classes are
just on your classpath like any other dependency.

## What the rest of these files show

- `RobotContainer.java` - registers two example leaf actions (`Intake`, `Shoot`) that wrap
  ordinary WPILib `Command`s via `WpilibNodes.registerCommandAction`, loads a tree from
  `src/main/deploy/autonomous.xml`, and optionally streams live node status to NetworkTables via
  `NTBehaviorTreeLogger`.
- `Robot.java` - schedules the tree (wrapped as a `Command` by `BehaviorTreeCommand`) in
  `autonomousInit()`, same as you'd schedule any other autonomous command.
- `commands/IntakeCommand.java`, `commands/ShootCommand.java` - ordinary `Command`s with
  console-print stand-ins for real hardware calls; nothing behavior-tree-specific about them at
  all, which is the point - any existing Command in your codebase can become a tree leaf.
- `subsystems/` - trivial stand-in subsystems the two commands require.
- `src/main/deploy/autonomous.xml` - the actual autonomous routine. Edit this file (and
  redeploy) to change robot behavior without touching Java code.

## Not covered here

Publishing to a Maven repo and using a real vendordep JSON (Option 2, for reuse across multiple
robot repos without a git submodule) is documented in [`java/README.md`](../../java/README.md).
