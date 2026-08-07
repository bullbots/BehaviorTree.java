package org.behaviortree.core;

/** Describes a single port declared by a node: its direction, type, default value and docs. */
public final class PortInfo extends TypeInfo
{
  private final PortDirection direction;
  private String description = "";
  private Object defaultValue;
  private String defaultValueString;
  private boolean hasDefaultValue = false;

  public PortInfo(PortDirection direction)
  {
    super();
    this.direction = direction;
  }

  public PortInfo(PortDirection direction, Class<?> type)
  {
    super(type);
    this.direction = direction;
  }

  public PortDirection direction()
  {
    return direction;
  }

  public String description()
  {
    return description;
  }

  public PortInfo setDescription(String description)
  {
    this.description = description == null ? "" : description;
    return this;
  }

  /** Sets a default value that is either an instance of the port's type, or a raw XML string. */
  public PortInfo setDefaultValue(Object value)
  {
    this.defaultValue = value;
    this.hasDefaultValue = true;
    try
    {
      this.defaultValueString = value instanceof String s ? s : Conversions.toStr(value);
    }
    catch(RuntimeException e)
    {
      this.defaultValueString = null;
    }
    return this;
  }

  public boolean hasDefaultValue()
  {
    return hasDefaultValue;
  }

  public Object defaultValue()
  {
    return defaultValue;
  }

  public String defaultValueString()
  {
    return defaultValueString;
  }
}
