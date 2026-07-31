package org.behaviortree.core;

/** The states a node can be in after being ticked. Custom nodes should never return IDLE. */
public enum NodeStatus
{
  IDLE,
  RUNNING,
  SUCCESS,
  FAILURE,
  SKIPPED;

  public boolean isActive()
  {
    return this != IDLE && this != SKIPPED;
  }

  public boolean isCompleted()
  {
    return this == SUCCESS || this == FAILURE;
  }
}
