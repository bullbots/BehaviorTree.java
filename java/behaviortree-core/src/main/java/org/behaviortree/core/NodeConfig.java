package org.behaviortree.core;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Configuration passed to a {@link TreeNode} at construction time; immutable once the node exists. */
public final class NodeConfig
{
  /** Blackboard used by this node. */
  public Blackboard blackboard;
  /** Enum values available to the scripting language, shared across the whole tree. */
  public Map<String, Integer> enums = new LinkedHashMap<>();
  /** port name -> raw XML attribute value (either a literal or a "{blackboard_key}" pointer). */
  public final Map<String, String> inputPorts = new LinkedHashMap<>();
  public final Map<String, String> outputPorts = new LinkedHashMap<>();
  /** Any other XML attributes that are not ports or a recognized built-in identifier. */
  public final Map<String, String> otherAttributes = new LinkedHashMap<>();

  public TreeNodeManifest manifest;

  /** Numeric unique identifier, assigned by the factory. */
  public int uid;
  /** Human readable identifier including the subtree hierarchy, e.g. "main/nested/myAction". */
  public String path = "";

  public final Map<PreCond, String> preConditions = new EnumMap<>(PreCond.class);
  public final Map<PostCond, String> postConditions = new EnumMap<>(PostCond.class);

  public NodeConfig()
  {}

  /** Returns a shallow copy of this config. */
  public NodeConfig copy()
  {
    NodeConfig c = new NodeConfig();
    c.blackboard = blackboard;
    c.enums = enums;
    c.inputPorts.putAll(inputPorts);
    c.outputPorts.putAll(outputPorts);
    c.otherAttributes.putAll(otherAttributes);
    c.manifest = manifest;
    c.uid = uid;
    c.path = path;
    c.preConditions.putAll(preConditions);
    c.postConditions.putAll(postConditions);
    return c;
  }
}
