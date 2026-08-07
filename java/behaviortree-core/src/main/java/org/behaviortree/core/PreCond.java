package org.behaviortree.core;

/**
 * Pre-conditions that can be attached to any node via XML attributes. Evaluated in declaration
 * order (FAILURE_IF, then SUCCESS_IF, then SKIP_IF, then WHILE_TRUE).
 *
 * <p><b>Important</b>: FAILURE_IF, SUCCESS_IF and SKIP_IF are evaluated only once, when the node
 * transitions from IDLE/SKIPPED to another state; they are not re-evaluated while RUNNING.
 * WHILE_TRUE is checked on both IDLE and RUNNING, and is the only precondition that can interrupt
 * a running node (if it becomes false, the node is halted and returns SKIPPED).
 */
public enum PreCond
{
  FAILURE_IF("_failureIf"),
  SUCCESS_IF("_successIf"),
  SKIP_IF("_skipIf"),
  WHILE_TRUE("_while");

  private final String attributeName;

  PreCond(String attributeName)
  {
    this.attributeName = attributeName;
  }

  public String attributeName()
  {
    return attributeName;
  }
}
