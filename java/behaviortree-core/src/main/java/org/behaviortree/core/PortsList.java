package org.behaviortree.core;

import java.util.LinkedHashMap;
import java.util.Map;

/** Ordered map of port name to {@link PortInfo}, equivalent to BT::PortsList. */
public final class PortsList extends LinkedHashMap<String, PortInfo>
{
  public PortsList()
  {
    super();
  }

  public PortsList(Map<String, PortInfo> other)
  {
    super(other);
  }
}
