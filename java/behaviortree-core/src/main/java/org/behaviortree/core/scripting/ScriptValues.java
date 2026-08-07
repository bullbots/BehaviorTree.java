package org.behaviortree.core.scripting;

import org.behaviortree.core.Blackboard;
import org.behaviortree.core.RuntimeError;

/** Value-model helpers shared by the AST node evaluators. Script-computed/literal numbers are
 * uniformly represented as {@link Double} (BT.CPP additionally distinguishes int64/uint64/double
 * internally; collapsing that distinction is immaterial for typical FRC scripting and values are
 * still coerced back to the target port's exact numeric type when read - see Blackboard). Boolean
 * blackboard values are treated as numbers too (true=1.0, false=0.0), which is a small, deliberate
 * ergonomic simplification over upstream's stricter Any::isNumber(). */
final class ScriptValues
{
  private ScriptValues()
  {}

  static boolean isNumber(Object v)
  {
    return v instanceof Number || v instanceof Boolean;
  }

  static boolean isStringValue(Object v)
  {
    return v instanceof String;
  }

  static double toDouble(Object v)
  {
    if(v instanceof Number n)
    {
      return n.doubleValue();
    }
    if(v instanceof Boolean b)
    {
      return b ? 1.0 : 0.0;
    }
    if(v instanceof String s)
    {
      return stringToDouble(s, null);
    }
    throw new RuntimeError("Cannot convert value to number: " + v);
  }

  static double stringToDouble(String s, Environment env)
  {
    if(s.equals("true"))
    {
      return 1.0;
    }
    if(s.equals("false"))
    {
      return 0.0;
    }
    if(env != null && env.enums != null && env.enums.containsKey(s))
    {
      return env.enums.get(s);
    }
    try
    {
      return Double.parseDouble(s.trim());
    }
    catch(NumberFormatException e)
    {
      throw new RuntimeError("Cannot convert string [" + s + "] to a number");
    }
  }

  static boolean toBoolean(Object v)
  {
    if(v instanceof Boolean b)
    {
      return b;
    }
    return toDouble(v) != 0.0;
  }

  static String toStringValue(Object v)
  {
    if(v instanceof String s)
    {
      return s;
    }
    if(v instanceof Double d)
    {
      // match BT.CPP's default double->string formatting closely enough for concatenation
      if(d == Math.rint(d) && !d.isInfinite())
      {
        return String.valueOf(d.longValue());
      }
      return String.valueOf(d);
    }
    return String.valueOf(v);
  }

  static long toInt64(Object v)
  {
    if(v instanceof Number n)
    {
      return n.longValue();
    }
    if(v instanceof Boolean b)
    {
      return b ? 1 : 0;
    }
    throw new RuntimeError("Cannot convert value to an integer: " + v);
  }

  static Object lookupVariable(String name, Environment env)
  {
    if(env.enums != null)
    {
      Integer enumValue = env.enums.get(name);
      if(enumValue != null)
      {
        return (double) enumValue;
      }
    }
    if(env.vars == null)
    {
      throw new RuntimeError("Variable not found: " + name);
    }
    Blackboard.Entry entry = env.vars.getEntry(name);
    if(entry == null || entry.value == null)
    {
      throw new RuntimeError("Variable not found: " + name);
    }
    synchronized(entry.lock)
    {
      return entry.value;
    }
  }
}
