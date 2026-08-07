package org.behaviortree.core;

/** Wraps any exception thrown out of a node's {@code tick()} with the node's identity, so the
 * failure can be traced back to a specific tree node instead of just a bare stack trace. */
public class NodeExecutionError extends BehaviorTreeException
{
  public final String nodeName;
  public final String fullPath;
  public final String registrationId;

  public NodeExecutionError(String nodeName, String fullPath, String registrationId,
                            String message)
  {
    super("Node [" + fullPath + "] (" + registrationId + "): " + message);
    this.nodeName = nodeName;
    this.fullPath = fullPath;
    this.registrationId = registrationId;
  }

  public NodeExecutionError(String nodeName, String fullPath, String registrationId,
                            String message, Throwable cause)
  {
    super("Node [" + fullPath + "] (" + registrationId + "): " + message, cause);
    this.nodeName = nodeName;
    this.fullPath = fullPath;
    this.registrationId = registrationId;
  }
}
