package org.behaviortree.core;

/**
 * Post-conditions that can be attached to any node via XML attributes. The declaration order
 * (ON_HALTED, ON_FAILURE, ON_SUCCESS, ALWAYS) is also the evaluation order.
 */
public enum PostCond
{
  ON_HALTED("_onHalted"),
  ON_FAILURE("_onFailure"),
  ON_SUCCESS("_onSuccess"),
  ALWAYS("_post");

  private final String attributeName;

  PostCond(String attributeName)
  {
    this.attributeName = attributeName;
  }

  public String attributeName()
  {
    return attributeName;
  }
}
