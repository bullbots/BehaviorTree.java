# BehaviorTree.CPP for Java / WPILib

A from-scratch Java port of the [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP)
engine, targeted at FRC robot code written against WPILib. It is not a JNI/JNA wrapper around the
C++ library - every class here is plain Java, re-implemented directly from the C++ source to match
its runtime semantics (see "Fidelity notes" below for the handful of deliberate differences).

## Modules

- **`behaviortree-core`** - the tree engine itself: `TreeNode` and all built-in control/decorator/
  action/condition nodes, the `Blackboard`, XML tree loading (`BehaviorTreeFactory`), and the
  embedded scripting language (`Script`, `_skipIf`, `Precondition`, etc.). Pure Java, zero WPILib
  dependency, usable outside of a robot project (e.g. in unit tests on a dev machine).
- **`behaviortree-wpilib`** - FRC integration: run a `Tree` as a `Command`
  (`BehaviorTreeCommand`), wrap a `Command` as a tree leaf (`CommandActionNode`), and stream live
  node status to NetworkTables for dashboard visibility (`NTBehaviorTreeLogger`).

## What was ported, and what wasn't

Everything needed to author and run real behavior trees on a robot: the full node hierarchy
(`Sequence`/`Fallback`/`Parallel`(`All`)/`Reactive*`/`Switch`/`IfThenElse`/`WhileDoElse`,
`Inverter`/`Retry`/`Repeat`/`Timeout`/`Delay`/`ForceSuccess`/`ForceFailure`/
`KeepRunningUntilFailure`/`RunOnce`/`Precondition`/`SkipUnlessUpdated`/`WaitValueUpdate`/`Loop`/
`SubTree`), the typed Blackboard and port system, the XML loader (including `<SubTree>` port
remapping/`_autoremap`, `<include>`, and `<TreeNodesModel>` mandatory-port validation), and the
embedded expression/scripting language used by `<Script>`, `ScriptCondition`, and the
`_skipIf`/`_successIf`/`_failureIf`/`_while`/`_onSuccess`/`_onFailure`/`_onHalted`/`_post`
node attributes.

Deliberately **not** ported, because none of it is needed to run a tree on an FRC robot and each
would have pulled in a dependency with no place in that world:

- **Groot2 live editor / ZeroMQ+flatbuffers wire protocol.** Use `NTBehaviorTreeLogger` instead -
  it streams node status to NetworkTables, which every FRC dashboard already knows how to display.
- **SQLite / minitrace logging.** Not meaningful on a roboRIO; use WPILib's own logging
  (DataLogManager, etc.) alongside the tree if you need a persistent record.
- **ROS2 integration.** Not applicable to FRC.
- **Coroutine-based `CoroActionNode`.** `StatefulActionNode` (onStart/onRunning/onHalted) is the
  async pattern that actually matters here, and it maps directly onto the FRC command lifecycle;
  Java also has no cheap stackful-coroutine primitive to port `CoroActionNode`'s mechanism to.

## Fidelity notes

A few spots are intentional, documented simplifications rather than 1:1 ports:

- **`Timeout`/`Delay`/`Sleep` are poll-based**, checking elapsed time once per `tick()` call,
  instead of upstream's background-thread timer queue. A tree is normally driven from an
  externally-clocked periodic loop (`robotPeriodic()`) in FRC, so a background timer thread would
  add complexity and a cross-thread hazard without adding responsiveness.
- **Scripting-language numbers are always represented as `Double`** internally (upstream
  additionally distinguishes `int64`/`uint64`/`double`). Values are still coerced to the exact
  target type when read through a typed port, so this is invisible in practice; it only matters
  for integers outside `2^53`, which don't come up in FRC scripting.
- **`Loop` works with any element type** read from a `Deque`/`Collection` blackboard entry, rather
  than being generated per-`T` as in C++. It does not support a semicolon-separated queue literal
  written directly in an XML attribute - only a blackboard-provided queue.
- **No polymorphic-downcast registry** for the Blackboard (upstream's `PolymorphicCastRegistry`
  works around a C++-specific limitation of `std::any` holding a `shared_ptr<Base>`); Java's own
  `instanceof`/generics make this unnecessary.

## Building and testing

`behaviortree-core` has no dependency beyond JUnit and builds anywhere:

```bash
cd java
./gradlew :behaviortree-core:build
```

`behaviortree-wpilib` compiles against WPILib's Java artifacts, resolved from
`https://frcmaven.wpi.edu/artifactory/release/`. Update `wpilibVersion` in `gradle.properties` to
match the WPILib release your robot project uses, then:

```bash
./gradlew :behaviortree-wpilib:build
```

> **Note:** the environment this port was written in has no network access to frcmaven.wpi.edu, so
> `behaviortree-wpilib` could not be compiled or test-run there. It was written directly against
> the stable, well-known `Command`/`CommandScheduler`/`NetworkTable` APIs, but you should build it
> once yourself (`./gradlew :behaviortree-wpilib:build`) before relying on it, and file an issue if
> anything doesn't compile against the WPILib version you're targeting.

## Using it in a robot project

**Quickest way to get started, no Maven hosting required:** point your robot project's
`settings.gradle` at this `java/` directory with Gradle's `includeBuild`, and add
`behaviortree-core`/`behaviortree-wpilib` to your `dependencies { }` block - full walkthrough and
a complete reference project in
[`examples/wpilib-robot-example`](../examples/wpilib-robot-example).

For a reusable dependency across multiple robot repos instead, publish it and use the vendordep
manifest:

The `vendordep/BehaviorTreeJava.json` file is a normal WPILib vendordep manifest. To actually use
it from a robot project this way:

1. Publish `behaviortree-core` and `behaviortree-wpilib` to a Maven repository your robot project
   can reach (GitHub Packages, a self-hosted Artifactory/Nexus, JitPack, or Maven Central all
   work - `./gradlew publish` after setting a `publishing.repositories.maven.url`).
2. Fill in `mavenUrls` and `jsonUrl` in `vendordep/BehaviorTreeJava.json` with that repository's
   URL, then host the JSON file itself somewhere reachable (or just commit it straight into
   `vendordeps/` in the robot project instead of using the online-catalog flow).
3. Drop the JSON into the robot project's `vendordeps/` directory; GradleRIO picks it up
   automatically on the next build.

## Example

```java
BehaviorTreeFactory factory = new BehaviorTreeFactory();
WpilibNodes.registerCommandAction(factory, "Intake", () -> new IntakeCommand(intakeSubsystem));

Tree tree = factory.createTreeFromFile(Path.of(Filesystem.getDeployDirectory().toString(),
    "autonomous.xml"));

// Run it as a Command, e.g. bound to autonomousCommand():
Command auto = new BehaviorTreeCommand(tree, intakeSubsystem, driveSubsystem);

// Optional: watch it run on the dashboard.
NTBehaviorTreeLogger logger = new NTBehaviorTreeLogger(tree,
    NetworkTableInstance.getDefault().getTable("BehaviorTree"));
```

```xml
<!-- deploy/autonomous.xml -->
<root BTCPP_format="4" main_tree_to_execute="Auto">
  <BehaviorTree ID="Auto">
    <Sequence>
      <Intake/>
      <Script code="target_x:=2.5"/>
      <Timeout msec="3000">
        <DriveToPoint x="{target_x}" y="0.0"/>
      </Timeout>
    </Sequence>
  </BehaviorTree>
</root>
```
