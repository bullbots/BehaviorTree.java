package org.behaviortree.core;

/** Converts the raw string found in an XML attribute (or a Blackboard string entry) into T. */
@FunctionalInterface
public interface StringConverter<T>
{
  T convert(String str);
}
