package org.behaviortree.core;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/** Lets a node ask the tree to be re-ticked promptly instead of waiting out a sleep, used by
 * {@link Tree#tickWhileRunning}. Not needed when the tree is ticked from an externally driven
 * periodic loop (e.g. WPILib's {@code Robot.robotPeriodic()}). */
public final class WakeUpSignal
{
  private final Lock lock = new ReentrantLock();
  private final Condition condition = lock.newCondition();
  private volatile boolean signaled = false;

  public void emitSignal()
  {
    lock.lock();
    try
    {
      signaled = true;
      condition.signalAll();
    }
    finally
    {
      lock.unlock();
    }
  }

  /** Sleeps up to {@code millis} or until {@link #emitSignal()} is called, whichever is first. */
  public void waitFor(long millis)
  {
    lock.lock();
    try
    {
      signaled = false;
      long deadline = System.nanoTime() + millis * 1_000_000L;
      while(!signaled)
      {
        long remainingNanos = deadline - System.nanoTime();
        if(remainingNanos <= 0)
        {
          return;
        }
        try
        {
          condition.awaitNanos(remainingNanos);
        }
        catch(InterruptedException e)
        {
          Thread.currentThread().interrupt();
          return;
        }
      }
    }
    finally
    {
      lock.unlock();
    }
  }
}
