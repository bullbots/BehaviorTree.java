package org.behaviortree.core;

/** Base class for all exceptions thrown by behaviortree-core. */
public class BehaviorTreeException extends RuntimeException
{
  public BehaviorTreeException(String message)
  {
    super(message);
  }

  public BehaviorTreeException(String message, Throwable cause)
  {
    super(message, cause);
  }
}
