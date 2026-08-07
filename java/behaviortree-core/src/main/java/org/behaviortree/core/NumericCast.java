package org.behaviortree.core;

/** Range checks used to decide whether re-assigning a strongly-typed numeric Blackboard entry with a value of a different numeric type is safe, mirroring BT::isCastingSafe(). */
final class NumericCast
{
  private NumericCast()
  {}

  static boolean isSafe(Class<?> targetType, Number value)
  {
    double v = value.doubleValue();
    if(targetType == Byte.class || targetType == byte.class)
    {
      return v == Math.floor(v) && v >= Byte.MIN_VALUE && v <= Byte.MAX_VALUE;
    }
    if(targetType == Short.class || targetType == short.class)
    {
      return v == Math.floor(v) && v >= Short.MIN_VALUE && v <= Short.MAX_VALUE;
    }
    if(targetType == Integer.class || targetType == int.class)
    {
      return v == Math.floor(v) && v >= Integer.MIN_VALUE && v <= Integer.MAX_VALUE;
    }
    if(targetType == Long.class || targetType == long.class)
    {
      return v == Math.floor(v) && v >= Long.MIN_VALUE && v <= Long.MAX_VALUE;
    }
    if(targetType == Float.class || targetType == float.class)
    {
      return v >= -Float.MAX_VALUE && v <= Float.MAX_VALUE;
    }
    if(targetType == Double.class || targetType == double.class)
    {
      return true;
    }
    return false;
  }

  static boolean isNumeric(Class<?> type)
  {
    return Number.class.isAssignableFrom(type) || type == byte.class || type == short.class
           || type == int.class || type == long.class || type == float.class
           || type == double.class;
  }
}
