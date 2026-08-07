package org.behaviortree.core;

import java.util.LinkedHashMap;
import java.util.Map;

/** Static metadata about a registered node type. Used mostly by the XML parser. */
public final class TreeNodeManifest
{
  public final NodeType type;
  public final String registrationId;
  public final PortsList ports;
  public final Map<String, String> metadata;

  public TreeNodeManifest(NodeType type, String registrationId, PortsList ports,
                          Map<String, String> metadata)
  {
    this.type = type;
    this.registrationId = registrationId;
    this.ports = ports;
    this.metadata = metadata == null ? new LinkedHashMap<>() : metadata;
  }
}
