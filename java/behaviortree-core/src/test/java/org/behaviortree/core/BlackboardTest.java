package org.behaviortree.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BlackboardTest
{
  @Test
  void setAndGetRoundTrip()
  {
    Blackboard bb = Blackboard.create();
    bb.set("answer", 42);
    assertEquals(42, bb.get("answer", Integer.class));
  }

  @Test
  void missingKeyThrows()
  {
    Blackboard bb = Blackboard.create();
    assertThrows(RuntimeError.class, () -> bb.get("nope", Integer.class));
  }

  @Test
  void tryGetReturnsEmptyForMissingKey()
  {
    Blackboard bb = Blackboard.create();
    assertTrue(bb.tryGet("nope", Integer.class).isEmpty());
  }

  @Test
  void typeLockPreventsIncompatibleReassignment()
  {
    Blackboard bb = Blackboard.create();
    bb.set("x", 1);
    assertThrows(LogicError.class, () -> bb.set("x", "not a number"));
  }

  @Test
  void safeNumericWideningIsAllowed()
  {
    Blackboard bb = Blackboard.create();
    bb.set("x", 100); // stored with declared type Integer
    bb.set("x", (byte) 5); // narrower numeric type, in-range: allowed
    assertEquals(5, bb.get("x", Integer.class));
  }

  @Test
  void stringEntryConvertsOnRead()
  {
    Blackboard bb = Blackboard.create();
    bb.set("count", "7");
    assertEquals(7, bb.get("count", Integer.class));
  }

  @Test
  void rootPrefixWritesToRootBlackboard()
  {
    Blackboard root = Blackboard.create();
    Blackboard child = Blackboard.create(root);
    child.set("@shared", "hello");
    assertEquals("hello", root.get("shared", String.class));
    assertEquals("hello", child.get("@shared", String.class));
  }

  @Test
  void subtreeRemappingRedirectsToParent()
  {
    Blackboard parent = Blackboard.create();
    parent.set("parentVar", 10);
    Blackboard child = Blackboard.create(parent);
    child.addSubtreeRemapping("childVar", "parentVar");
    assertEquals(10, child.get("childVar", Integer.class));
    child.set("childVar", 20);
    assertEquals(20, parent.get("parentVar", Integer.class));
  }

  @Test
  void autoRemappingFallsThroughToParentForNonPrivateKeys()
  {
    Blackboard parent = Blackboard.create();
    parent.set("shared", 1);
    Blackboard child = Blackboard.create(parent);
    child.enableAutoRemapping(true);
    assertEquals(1, child.get("shared", Integer.class));
    assertFalse(child.tryGet("_private", Integer.class).isPresent());
  }

  @Test
  void unsetRemovesEntry()
  {
    Blackboard bb = Blackboard.create();
    bb.set("x", 1);
    bb.unset("x");
    assertTrue(bb.tryGet("x", Integer.class).isEmpty());
  }
}
