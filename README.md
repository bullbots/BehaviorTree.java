![License MIT](https://img.shields.io/github/license/BehaviorTree/BehaviorTree.CPP?color=blue)

# BehaviorTree.CPP for Java / WPILib

<p align="center"><img width=350 src="animated.svg"></p>

This fork ports [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) to a
from-scratch __Java__ library for __FRC__ robot code written against __WPILib__. It provides a
framework to create BehaviorTrees, designed to be flexible, easy to use, reactive and fast -
built for the same reasons teams reach for command-based programming, but for coordinating
larger, more dynamic autonomous/teleop behaviors than a single `Command` composition comfortably
expresses.

There are a few features that make __BehaviorTree.CPP__ unique, when compared to other
implementations, all of which carry over to this port:

- It makes __asynchronous Actions__, i.e. non-blocking, a first-class citizen - a natural fit for
  the FRC command lifecycle (`initialize`/`execute`/`end`).

- You can build __reactive__ behaviors that execute multiple Actions concurrently (orthogonality).

- Trees are defined using a Domain Specific __scripting language__ (based on XML), and can be
  loaded at run-time; in other words, even if written in Java, the morphology of the Trees is
  _not_ hard-coded - deploy a new autonomous routine by editing an XML file, no recompile needed.

- You can register your own `TreeNode` subclasses, or wrap an existing WPILib `Command` as a leaf
  with a single line of code.

- It provides a type-safe and flexible mechanism to do __Dataflow__ between Nodes of the Tree via
  a typed Blackboard.

- Live node status can be streamed to NetworkTables, so you can watch a tree run on
  Shuffleboard/Elastic/AdvantageScope while testing.

The Java port lives entirely under [`java/`](java/); see **[java/README.md](java/README.md)** for
what was ported, what was deliberately left out (and why), build instructions, and a usage
example. The original C++17 library this was ported from is unchanged and still builds normally
from the repository root - see below.

## Documentation

- **Java port docs, scope, and usage example**: [java/README.md](java/README.md)
- **Upstream BT.CPP tutorials and general documentation** (the concepts, XML format, and
  scripting language are shared): https://www.behaviortree.dev/
- **Upstream auto-generated Doxygen** (for the original C++ API): https://behaviortree.github.io/BehaviorTree.CPP/

## GUI Editor

Editing a BehaviorTree is as simple as editing an XML file in your favorite text editor, and the
XML format is shared with upstream BT.CPP, so [Groot2](https://www.behaviortree.dev/groot) can
still be used to *author* trees for this port.

Groot2's *live monitoring*, however, talks to a running tree over ZeroMQ, which this port does not
implement (see [java/README.md](java/README.md) for why). For live monitoring on a robot, use
`NTBehaviorTreeLogger` instead, which streams node status to NetworkTables so any FRC dashboard
can display it.

![Groot screenshot](docs/groot-screenshot.png)

## How to compile

### Java port

Requires a JDK compatible with WPILib's target (Java 17+). From the `java/` directory:

```bash
cd java
./gradlew :behaviortree-core:build   # pure-Java engine + tests, builds anywhere
./gradlew :behaviortree-wpilib:build # FRC/Command-based integration, needs frcmaven.wpi.edu
```

See [java/README.md](java/README.md) for how to publish the modules and consume them from a
robot project as a GradleRIO vendor library.

### Original C++ library

The C++17 source this was ported from is untouched and still lives at the repository root
(`include/`, `src/`, `CMakeLists.txt`, etc.). Three build systems are supported there - colcon
(ROS2), conan, or plain CMake - see the
[upstream BehaviorTree.CPP README](https://github.com/BehaviorTree/BehaviorTree.CPP#how-to-compile)
for details, or:

```bash
mkdir build && cmake -S . -B build && cmake --build build --parallel
```

## Commercial support

For the original C++ library: are you using BT.CPP in your commercial product, and do you need
technical support / consulting? You can contact the primary author,
**dfaconti@aurynrobotics.com**, to discuss your use case and needs.

# Star History

[![Star History Chart](https://api.star-history.com/svg?repos=BehaviorTree/BehaviorTree.CPP&type=Date)](https://star-history.com/#BehaviorTree/BehaviorTree.CPP&Date)

# Contributors

<a href="https://github.com/BehaviorTree/BehaviorTree.CPP/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BehaviorTree/BehaviorTree.CPP" />
</a>

# License

The MIT License (MIT)

Copyright (c) 2019-2026 Davide Faconti

Copyright (c) 2018-2019 Davide Faconti, Eurecat

Copyright (c) 2014-2018 Michele Colledanchise

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
