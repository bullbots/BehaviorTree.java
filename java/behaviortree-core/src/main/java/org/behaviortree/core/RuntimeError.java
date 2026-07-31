package org.behaviortree.core;

/**
 * Thrown for errors detected while a tree is running (mirrors BT::RuntimeError in
 * BehaviorTree.CPP), e.g. a missing blackboard key or a port type mismatch discovered at tick
 * time.
 */
public class RuntimeError extends BehaviorTreeException
{
  public RuntimeError(String message)
  {
    super(message);
  }

  public RuntimeError(String message, Throwable cause)
  {
    super(message, cause);
  }
}
