package org.behaviortree.core.controls;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.behaviortree.core.ControlNode;
import org.behaviortree.core.LogicError;
import org.behaviortree.core.NodeConfig;
import org.behaviortree.core.NodeStatus;
import org.behaviortree.core.Port;
import org.behaviortree.core.PortsList;
import org.behaviortree.core.TreeNode;

/**
 * Equivalent to a C-style switch statement: ticks the one child whose case matches the
 * {@code variable} port's current value (comparing as strings, then as integers, then as reals),
 * or the last child (the default branch) if none match. Requires exactly {@code numCases + 1}
 * children.
 */
public class SwitchNode extends ControlNode
{
  private final int numCases;
  private final List<String> caseKeys;
  private int runningChild = -1;

  public SwitchNode(String name, NodeConfig config, int numCases)
  {
    super(name, config);
    this.numCases = numCases;
    this.caseKeys = new ArrayList<>();
    for(int i = 1; i <= numCases; i++)
    {
      caseKeys.add("case_" + i);
    }
    setRegistrationId("Switch" + numCases);
  }

  public static PortsList providedPorts(int numCases)
  {
    List<Map.Entry<String, org.behaviortree.core.PortInfo>> entries = new ArrayList<>();
    entries.add(Port.input(String.class, "variable"));
    for(int i = 1; i <= numCases; i++)
    {
      entries.add(Port.input(String.class, "case_" + i));
    }
    @SuppressWarnings("unchecked")
    Map.Entry<String, org.behaviortree.core.PortInfo>[] arr = entries.toArray(new Map.Entry[0]);
    return Port.list(arr);
  }

  @Override
  protected void halt()
  {
    runningChild = -1;
    super.halt();
  }

  @Override
  protected NodeStatus tick()
  {
    if(childrenCount() != numCases + 1)
    {
      throw new LogicError("Wrong number of children in SwitchNode; must be (num_cases + "
                           + "default)");
    }

    Optional<String> variable = tryGetInput("variable", String.class);
    int matchIndex = numCases;

    if(variable.isPresent())
    {
      for(int index = 0; index < numCases; index++)
      {
        Optional<String> value = tryGetInput(caseKeys.get(index), String.class);
        if(value.isPresent()
           && checkStringEquality(variable.get(), value.get(), config().enums))
        {
          matchIndex = index;
          break;
        }
      }
    }

    if(runningChild != -1 && runningChild != matchIndex)
    {
      haltChild(runningChild);
    }

    TreeNode selected = children.get(matchIndex);
    NodeStatus ret = selected.executeTick();
    if(ret == NodeStatus.SKIPPED)
    {
      runningChild = -1;
      return NodeStatus.SKIPPED;
    }
    else if(ret == NodeStatus.RUNNING)
    {
      runningChild = matchIndex;
    }
    else
    {
      resetChildren();
      runningChild = -1;
    }
    return ret;
  }

  private static boolean checkStringEquality(String v1, String v2, Map<String, Integer> enums)
  {
    if(v1.equals(v2))
    {
      return true;
    }
    Integer v1int = toInt(v1, enums);
    Integer v2int = toInt(v2, enums);
    if(v1int != null && v2int != null && v1int.intValue() == v2int.intValue())
    {
      return true;
    }
    Double v1real = toReal(v1, enums);
    Double v2real = toReal(v2, enums);
    double eps = Math.ulp(1.0f);
    return v1real != null && v2real != null && Math.abs(v1real - v2real) <= eps;
  }

  private static Integer toInt(String str, Map<String, Integer> enums)
  {
    if(enums != null && enums.containsKey(str))
    {
      return enums.get(str);
    }
    try
    {
      return Integer.parseInt(str.trim());
    }
    catch(NumberFormatException e)
    {
      return null;
    }
  }

  private static Double toReal(String str, Map<String, Integer> enums)
  {
    if(enums != null && enums.containsKey(str))
    {
      return enums.get(str).doubleValue();
    }
    try
    {
      return Double.parseDouble(str.trim());
    }
    catch(NumberFormatException e)
    {
      return null;
    }
  }
}
