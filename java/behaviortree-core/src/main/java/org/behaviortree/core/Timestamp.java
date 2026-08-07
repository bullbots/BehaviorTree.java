package org.behaviortree.core;

/** Sequence number and wall-clock time of the last write to a blackboard entry. */
public final class Timestamp
{
  public static final Timestamp ZERO = new Timestamp(0, 0);

  public final long seq;
  /** Nanoseconds since epoch. */
  public final long timeNanos;

  public Timestamp(long seq, long timeNanos)
  {
    this.seq = seq;
    this.timeNanos = timeNanos;
  }
}
