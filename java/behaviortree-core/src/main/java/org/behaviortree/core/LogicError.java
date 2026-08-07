package org.behaviortree.core;

/**
 * Thrown for programming errors that could have been detected statically (mirrors
 * BT::LogicError in BehaviorTree.CPP), e.g. registering two nodes with the same ID, or an invalid
 * port declaration.
 */
public class LogicError extends BehaviorTreeException
{
  public LogicError(String message)
  {
    super(message);
  }

  public LogicError(String message, Throwable cause)
  {
    super(message, cause);
  }
}
