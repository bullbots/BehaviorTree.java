package org.behaviortree.core;

import java.util.AbstractMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builders for port declarations, used in a node's {@code providedPorts()} method. Mirrors
 * {@code BT::InputPort<T>()}, {@code BT::OutputPort<T>()} and {@code BT::BidirectionalPort<T>()}.
 *
 * <pre>{@code
 * public static PortsList providedPorts() {
 *   return Port.list(
 *       Port.input(Double.class, "goal"),
 *       Port.output(Boolean.class, "reached", "true once the goal is reached"));
 * }
 * }</pre>
 */
public final class Port
{
  private Port()
  {}

  public static Map.Entry<String, PortInfo> create(PortDirection direction, Class<?> type,
                                                    String name, String description)
  {
    if(!NamingUtil.isAllowedPortName(name))
    {
      throw new RuntimeError("The name of a port must not be `name` or `ID`, must start with an "
                             + "alphabetic character, and must not contain reserved characters. "
                             + "Offending name: [" + name + "]");
    }
    PortInfo info = (type == null || type == TypeInfo.ANY_TYPE) ? new PortInfo(direction)
                                                                 : new PortInfo(direction, type);
    if(description != null && !description.isEmpty())
    {
      info.setDescription(description);
    }
    return new AbstractMap.SimpleImmutableEntry<>(name, info);
  }

  public static Map.Entry<String, PortInfo> input(Class<?> type, String name)
  {
    return create(PortDirection.INPUT, type, name, null);
  }

  public static Map.Entry<String, PortInfo> input(Class<?> type, String name, String description)
  {
    return create(PortDirection.INPUT, type, name, description);
  }

  public static <T> Map.Entry<String, PortInfo> input(Class<T> type, String name,
                                                       T defaultValue, String description)
  {
    Map.Entry<String, PortInfo> e = create(PortDirection.INPUT, type, name, description);
    e.getValue().setDefaultValue(defaultValue);
    return e;
  }

  public static Map.Entry<String, PortInfo> input(Class<?> type, String name,
                                                   String defaultBlackboardOrLiteral,
                                                   String description)
  {
    Map.Entry<String, PortInfo> e = create(PortDirection.INPUT, type, name, description);
    e.getValue().setDefaultValue(defaultBlackboardOrLiteral);
    return e;
  }

  public static Map.Entry<String, PortInfo> input(String name)
  {
    return create(PortDirection.INPUT, TypeInfo.ANY_TYPE, name, null);
  }

  public static Map.Entry<String, PortInfo> input(String name, String description)
  {
    return create(PortDirection.INPUT, TypeInfo.ANY_TYPE, name, description);
  }

  public static Map.Entry<String, PortInfo> output(Class<?> type, String name)
  {
    return create(PortDirection.OUTPUT, type, name, null);
  }

  public static Map.Entry<String, PortInfo> output(Class<?> type, String name,
                                                    String description)
  {
    return create(PortDirection.OUTPUT, type, name, description);
  }

  /** Output port with a default blackboard key, e.g. {@code "{result}"}. */
  public static Map.Entry<String, PortInfo> output(Class<?> type, String name,
                                                    String defaultBlackboardKey,
                                                    String description)
  {
    if(defaultBlackboardKey == null || !defaultBlackboardKey.startsWith("{")
       || !defaultBlackboardKey.endsWith("}"))
    {
      throw new LogicError("Output port can only refer to blackboard entries, i.e. use the "
                           + "syntax '{port_name}'");
    }
    Map.Entry<String, PortInfo> e = create(PortDirection.OUTPUT, type, name, description);
    e.getValue().setDefaultValue(defaultBlackboardKey);
    return e;
  }

  public static Map.Entry<String, PortInfo> output(String name)
  {
    return create(PortDirection.OUTPUT, TypeInfo.ANY_TYPE, name, null);
  }

  public static Map.Entry<String, PortInfo> output(String name, String description)
  {
    return create(PortDirection.OUTPUT, TypeInfo.ANY_TYPE, name, description);
  }

  public static Map.Entry<String, PortInfo> inout(Class<?> type, String name)
  {
    return create(PortDirection.INOUT, type, name, null);
  }

  public static Map.Entry<String, PortInfo> inout(Class<?> type, String name,
                                                   String description)
  {
    return create(PortDirection.INOUT, type, name, description);
  }

  public static <T> Map.Entry<String, PortInfo> inout(Class<T> type, String name, T defaultValue,
                                                       String description)
  {
    Map.Entry<String, PortInfo> e = create(PortDirection.INOUT, type, name, description);
    e.getValue().setDefaultValue(defaultValue);
    return e;
  }

  public static Map.Entry<String, PortInfo> inout(String name)
  {
    return create(PortDirection.INOUT, TypeInfo.ANY_TYPE, name, null);
  }

  public static Map.Entry<String, PortInfo> inout(String name, String description)
  {
    return create(PortDirection.INOUT, TypeInfo.ANY_TYPE, name, description);
  }

  @SafeVarargs
  public static PortsList list(Map.Entry<String, PortInfo>... ports)
  {
    LinkedHashMap<String, PortInfo> map = new LinkedHashMap<>();
    for(Map.Entry<String, PortInfo> p : ports)
    {
      map.put(p.getKey(), p.getValue());
    }
    return new PortsList(map);
  }
}
