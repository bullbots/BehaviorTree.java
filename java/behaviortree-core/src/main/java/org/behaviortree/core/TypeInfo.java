package org.behaviortree.core;

/**
 * Runtime type information attached to a port. When {@link #type()} is {@link Object}, the port
 * accepts any type (equivalent to {@code BT::AnyTypeAllowed} in BehaviorTree.CPP).
 */
public class TypeInfo
{
  /** Sentinel type used to mean "any type is allowed", mirroring BT::AnyTypeAllowed. */
  public static final Class<Object> ANY_TYPE = Object.class;

  private final Class<?> type;
  private final String typeName;

  public TypeInfo()
  {
    this.type = ANY_TYPE;
    this.typeName = "AnyTypeAllowed";
  }

  public TypeInfo(Class<?> type)
  {
    this.type = type;
    this.typeName = type.getSimpleName();
  }

  public Class<?> type()
  {
    return type;
  }

  public String typeName()
  {
    return typeName;
  }

  public boolean isStronglyTyped()
  {
    return type != ANY_TYPE;
  }

  /** Parses a raw string using the {@link Conversions} registry entry for {@link #type()}. */
  public Object parseString(String str)
  {
    if(!isStronglyTyped())
    {
      return str;
    }
    return Conversions.convertFromString(type, str);
  }
}
