package org.behaviortree.core.scripting;

import java.util.Map;
import org.behaviortree.core.Blackboard;

/** A compiled script (e.g. from a {@code <Script code="..."/>} node or a {@code _skipIf}
 * attribute), ready to be evaluated against a Blackboard. */
@FunctionalInterface
public interface ScriptFunction
{
  Object evaluate(Blackboard blackboard, Map<String, Integer> enums);
}
