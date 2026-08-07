package org.behaviortree.core;

/** Constructs a {@link TreeNode} instance from an instance name and a fully-resolved config. */
@FunctionalInterface
public interface NodeBuilder
{
  TreeNode build(String name, NodeConfig config);
}
