package org.behaviortree.core.scripting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.Map;
import org.behaviortree.core.Blackboard;
import org.behaviortree.core.RuntimeError;
import org.junit.jupiter.api.Test;

class ScriptParserTest
{
  private static double run(Blackboard bb, String script)
  {
    Object result = ScriptParser.parse(script).evaluate(bb, new LinkedHashMap<>());
    return ScriptSupport.toDouble(result);
  }

  @Test
  void simpleCreateAssignment()
  {
    Blackboard bb = Blackboard.create();
    ScriptParser.parse("A:=1;B:=2").evaluate(bb, new LinkedHashMap<>());
    assertEquals(1, bb.get("A", Integer.class));
    assertEquals(2, bb.get("B", Integer.class));
  }

  @Test
  void arithmeticPrecedence()
  {
    Blackboard bb = Blackboard.create();
    assertEquals(1 + 2 * 3, run(bb, "1 + 2 * 3"));
    assertEquals((1 + 2) * 3, run(bb, "(1 + 2) * 3"));
  }

  @Test
  void chainedComparison()
  {
    Blackboard bb = Blackboard.create();
    assertEquals(1.0, run(bb, "1 < 2 && 2 < 3"));
    assertEquals(1.0, run(bb, "1 < 2 < 3")); // chained: (1<2) is true, (2<3) is true
  }

  @Test
  void ternaryOperator()
  {
    Blackboard bb = Blackboard.create();
    assertEquals(42.0, run(bb, "true ? 42 : 0"));
    assertEquals(0.0, run(bb, "false ? 42 : 0"));
  }

  @Test
  void stringConcatenation()
  {
    Blackboard bb = Blackboard.create();
    Object result = ScriptParser.parse("msg := 'hello' .. ' ' .. 'world'")
                                 .evaluate(bb, new LinkedHashMap<>());
    assertEquals("hello world", bb.get("msg", String.class));
  }

  @Test
  void compoundAssignment()
  {
    Blackboard bb = Blackboard.create();
    bb.set("x", 10);
    ScriptParser.parse("x += 5").evaluate(bb, new LinkedHashMap<>());
    assertEquals(15, bb.get("x", Integer.class));
  }

  @Test
  void assignToUndeclaredVariableWithEqualsThrows()
  {
    Blackboard bb = Blackboard.create();
    assertThrows(RuntimeError.class,
                () -> ScriptParser.parse("y = 1").evaluate(bb, new LinkedHashMap<>()));
  }

  @Test
  void enumRegistryResolvesBareNames()
  {
    Blackboard bb = Blackboard.create();
    Map<String, Integer> enums = new LinkedHashMap<>();
    enums.put("RED", 1);
    Object result = ScriptParser.parse("color := RED").evaluate(bb, enums);
    assertEquals(1, bb.get("color", Integer.class));
  }

  @Test
  void rootPrefixTargetsRootBlackboard()
  {
    Blackboard root = Blackboard.create();
    Blackboard child = Blackboard.create(root);
    ScriptParser.parse("@var3:=3").evaluate(child, new LinkedHashMap<>());
    assertEquals(3, root.get("var3", Integer.class));
  }

  @Test
  void copyVariableToVariable()
  {
    Blackboard bb = Blackboard.create();
    bb.set("first_point", 7);
    ScriptParser.parse("other_point:=first_point").evaluate(bb, new LinkedHashMap<>());
    assertEquals(7, bb.get("other_point", Integer.class));
  }

  @Test
  void lastStatementValueIsReturned()
  {
    Blackboard bb = Blackboard.create();
    Object result = ScriptParser.parse("A:=1; A+1").evaluate(bb, new LinkedHashMap<>());
    assertEquals(2.0, ScriptSupport.toDouble(result));
  }

  @Test
  void emptyScriptThrows()
  {
    assertThrows(RuntimeError.class, () -> ScriptParser.parse("   "));
  }
}
