package org.behaviortree.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry of {@code String -> T} and {@code T -> String} conversions, used to parse XML/
 * blackboard string values into typed values and back. Mirrors {@code convertFromString<T>()}
 * and {@code toStr<T>()} in BehaviorTree.CPP's basic_types.h.
 *
 * <p>Built-in conversions are provided for primitives/wrappers, {@link String}, {@link Boolean},
 * {@link NodeStatus}, {@link NodeType}, {@link PortDirection}, and the semicolon-separated array
 * types {@code int[]}, {@code long[]}, {@code double[]}, {@code boolean[]}, {@code String[]}.
 * Register a converter for any other custom type with {@link #register}.
 */
public final class Conversions
{
  private Conversions()
  {}

  private static final Map<Class<?>, StringConverter<?>> FROM_STRING = new ConcurrentHashMap<>();
  private static final Map<Class<?>, java.util.function.Function<?, String>> TO_STRING =
      new ConcurrentHashMap<>();

  static
  {
    register(String.class, s -> s, s -> s);
    register(Boolean.class, Conversions::parseBool, String::valueOf);
    register(boolean.class, Conversions::parseBool, String::valueOf);
    register(Integer.class, s -> (int) parseLong(s), String::valueOf);
    register(int.class, s -> (int) parseLong(s), String::valueOf);
    register(Long.class, Conversions::parseLong, String::valueOf);
    register(long.class, Conversions::parseLong, String::valueOf);
    register(Short.class, s -> (short) parseLong(s), String::valueOf);
    register(short.class, s -> (short) parseLong(s), String::valueOf);
    register(Byte.class, s -> (byte) parseLong(s), String::valueOf);
    register(byte.class, s -> (byte) parseLong(s), String::valueOf);
    register(Float.class, s -> (float) parseDouble(s), String::valueOf);
    register(float.class, s -> (float) parseDouble(s), String::valueOf);
    register(Double.class, Conversions::parseDouble, String::valueOf);
    register(double.class, Conversions::parseDouble, String::valueOf);

    register(NodeStatus.class, s -> NodeStatus.valueOf(s.trim().toUpperCase()),
             Object::toString);
    register(NodeType.class, s -> NodeType.valueOf(s.trim().toUpperCase()), Object::toString);
    register(PortDirection.class, s -> PortDirection.valueOf(s.trim().toUpperCase()),
             Object::toString);

    register(int[].class, s -> toIntArray(splitList(s)), Conversions::arrayToStr);
    register(long[].class, s -> toLongArray(splitList(s)), Conversions::arrayToStr);
    register(double[].class, s -> toDoubleArray(splitList(s)), Conversions::arrayToStr);
    register(boolean[].class, s -> toBoolArray(splitList(s)), Conversions::arrayToStr);
    register(String[].class, s -> splitList(s).toArray(new String[0]), Conversions::arrayToStr);
  }

  public static <T> void register(Class<T> type, StringConverter<T> fromString,
                                  java.util.function.Function<T, String> toString)
  {
    FROM_STRING.put(type, fromString);
    TO_STRING.put(type, toString);
  }

  public static boolean hasConverter(Class<?> type)
  {
    return FROM_STRING.containsKey(type) || type.isEnum();
  }

  @SuppressWarnings("unchecked")
  public static <T> T convertFromString(Class<T> type, String str)
  {
    if(type.isEnum())
    {
      return (T) parseEnum((Class<? extends Enum>) type, str);
    }
    StringConverter<?> converter = FROM_STRING.get(type);
    if(converter == null)
    {
      throw new LogicError("Conversions.convertFromString(): no converter registered for type ["
                           + type.getName() + "]. Call Conversions.register() first.");
    }
    return (T) converter.convert(str);
  }

  @SuppressWarnings({ "unchecked", "rawtypes" })
  private static Enum<?> parseEnum(Class<? extends Enum> type, String str)
  {
    return Enum.valueOf(type, str.trim());
  }

  @SuppressWarnings("unchecked")
  public static <T> String toStr(T value)
  {
    if(value == null)
    {
      return "";
    }
    if(value instanceof String s)
    {
      return s;
    }
    if(value.getClass().isEnum())
    {
      return value.toString();
    }
    java.util.function.Function<T, String> fn =
        (java.util.function.Function<T, String>) TO_STRING.get(value.getClass());
    if(fn != null)
    {
      return fn.apply(value);
    }
    return value.toString();
  }

  private static boolean parseBool(String s)
  {
    String t = s.trim();
    if(t.equals("1") || t.equalsIgnoreCase("true"))
    {
      return true;
    }
    if(t.equals("0") || t.equalsIgnoreCase("false"))
    {
      return false;
    }
    throw new RuntimeError("convertFromString(): invalid boolean value [" + s + "]");
  }

  private static long parseLong(String s)
  {
    try
    {
      return Long.parseLong(s.trim());
    }
    catch(NumberFormatException e)
    {
      throw new RuntimeError("convertFromString(): invalid integer value [" + s + "]");
    }
  }

  private static double parseDouble(String s)
  {
    try
    {
      return Double.parseDouble(s.trim());
    }
    catch(NumberFormatException e)
    {
      throw new RuntimeError("convertFromString(): invalid double value [" + s + "]");
    }
  }

  private static List<String> splitList(String s)
  {
    List<String> out = new ArrayList<>();
    for(String part : s.split(";"))
    {
      out.add(part.trim());
    }
    return out;
  }

  private static int[] toIntArray(List<String> parts)
  {
    int[] out = new int[parts.size()];
    for(int i = 0; i < parts.size(); i++)
    {
      out[i] = (int) parseLong(parts.get(i));
    }
    return out;
  }

  private static long[] toLongArray(List<String> parts)
  {
    long[] out = new long[parts.size()];
    for(int i = 0; i < parts.size(); i++)
    {
      out[i] = parseLong(parts.get(i));
    }
    return out;
  }

  private static double[] toDoubleArray(List<String> parts)
  {
    double[] out = new double[parts.size()];
    for(int i = 0; i < parts.size(); i++)
    {
      out[i] = parseDouble(parts.get(i));
    }
    return out;
  }

  private static boolean[] toBoolArray(List<String> parts)
  {
    boolean[] out = new boolean[parts.size()];
    for(int i = 0; i < parts.size(); i++)
    {
      out[i] = parseBool(parts.get(i));
    }
    return out;
  }

  private static String arrayToStr(Object array)
  {
    StringBuilder sb = new StringBuilder();
    int length = java.lang.reflect.Array.getLength(array);
    for(int i = 0; i < length; i++)
    {
      if(i > 0)
      {
        sb.append(';');
      }
      sb.append(java.lang.reflect.Array.get(array, i));
    }
    return sb.toString();
  }
}
