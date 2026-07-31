package org.behaviortree.core;

/** A value paired with the {@link Timestamp} of the write that produced it. */
public final class StampedValue<T>
{
  public final T value;
  public final Timestamp stamp;

  public StampedValue(T value, Timestamp stamp)
  {
    this.value = value;
    this.stamp = stamp;
  }
}
