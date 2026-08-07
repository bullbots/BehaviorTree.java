package org.behaviortree.core.scripting;

import org.behaviortree.core.RuntimeError;

/** Shared coercion helpers used by the scripting evaluator and by pre/post-condition checks. */
public final class ScriptSupport
{
  private ScriptSupport()
  {}

  public static boolean toBoolean(Object value)
  {
    if(value instanceof Boolean b)
    {
      return b;
    }
    if(value instanceof Number n)
    {
      return n.doubleValue() != 0.0;
    }
    if(value instanceof String s)
    {
      if(s.equalsIgnoreCase("true"))
      {
        return true;
      }
      if(s.equalsIgnoreCase("false"))
      {
        return false;
      }
      try
      {
        return Double.parseDouble(s) != 0.0;
      }
      catch(NumberFormatException e)
      {
        throw new RuntimeError("Cannot convert string [" + s + "] to boolean");
      }
    }
    throw new RuntimeError("Cannot convert value of type "
                           + (value == null ? "null" : value.getClass().getName())
                           + " to boolean");
  }

  public static double toDouble(Object value)
  {
    if(value instanceof Number n)
    {
      return n.doubleValue();
    }
    if(value instanceof Boolean b)
    {
      return b ? 1.0 : 0.0;
    }
    if(value instanceof String s)
    {
      return stringToDouble(s);
    }
    throw new RuntimeError("Cannot convert value of type "
                           + (value == null ? "null" : value.getClass().getName())
                           + " to a number");
  }

  public static double stringToDouble(String s)
  {
    String t = s.trim();
    if(t.equalsIgnoreCase("true"))
    {
      return 1.0;
    }
    if(t.equalsIgnoreCase("false"))
    {
      return 0.0;
    }
    try
    {
      return Double.parseDouble(t);
    }
    catch(NumberFormatException e)
    {
      throw new RuntimeError("Cannot convert string [" + s + "] to a number");
    }
  }

  public static boolean isNumber(Object value)
  {
    return value instanceof Number;
  }
}
