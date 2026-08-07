package org.behaviortree.core.scripting;

import java.util.Map;
import org.behaviortree.core.Blackboard;

final class Environment
{
  final Blackboard vars;
  final Map<String, Integer> enums;

  Environment(Blackboard vars, Map<String, Integer> enums)
  {
    this.vars = vars;
    this.enums = enums;
  }
}
