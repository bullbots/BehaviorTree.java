package org.behaviortree.core.scripting;

import java.util.ArrayList;
import java.util.List;
import org.behaviortree.core.RuntimeError;

/** A chained comparison, e.g. {@code a < b < c}, short-circuiting to 0.0 (false) at the first
 * failing link and returning 1.0 (true) only if every link holds. */
final class ExprComparison implements Expr
{
  enum Op
  {
    EQUAL, NOT_EQUAL, LESS, GREATER, LESS_EQUAL, GREATER_EQUAL
  }

  private static final double EPS = Math.ulp(1.0f);

  final List<Op> ops = new ArrayList<>();
  final List<Expr> operands = new ArrayList<>();

  private static boolean isSame(double a, double b)
  {
    return Math.abs(a - b) <= EPS;
  }

  private static boolean evalOp(double lv, double rv, Op op)
  {
    switch(op)
    {
      case EQUAL:
        return isSame(lv, rv);
      case NOT_EQUAL:
        return !isSame(lv, rv);
      case LESS:
        return lv < rv;
      case GREATER:
        return lv > rv;
      case LESS_EQUAL:
        return lv <= rv;
      case GREATER_EQUAL:
        return lv >= rv;
      default:
        return false;
    }
  }

  private static boolean evalOp(String lv, String rv, Op op)
  {
    int cmp = lv.compareTo(rv);
    switch(op)
    {
      case EQUAL:
        return lv.equals(rv);
      case NOT_EQUAL:
        return !lv.equals(rv);
      case LESS:
        return cmp < 0;
      case GREATER:
        return cmp > 0;
      case LESS_EQUAL:
        return cmp <= 0;
      case GREATER_EQUAL:
        return cmp >= 0;
      default:
        return false;
    }
  }

  @Override
  public Object evaluate(Environment env)
  {
    Object lhsV = operands.get(0).evaluate(env);
    for(int i = 0; i < ops.size(); i++)
    {
      Object rhsV = operands.get(i + 1).evaluate(env);
      Op op = ops.get(i);

      if(lhsV == null)
      {
        throw new RuntimeError("The left operand of a comparison is not initialized");
      }
      if(rhsV == null)
      {
        throw new RuntimeError("The right operand of a comparison is not initialized");
      }

      boolean result;
      if(ScriptValues.isNumber(lhsV) && ScriptValues.isNumber(rhsV))
      {
        result = evalOp(ScriptValues.toDouble(lhsV), ScriptValues.toDouble(rhsV), op);
      }
      else if(ScriptValues.isStringValue(lhsV) && ScriptValues.isStringValue(rhsV))
      {
        result = evalOp((String) lhsV, (String) rhsV, op);
      }
      else if(ScriptValues.isStringValue(lhsV) && ScriptValues.isNumber(rhsV))
      {
        result = evalOp(ScriptValues.stringToDouble((String) lhsV, env),
                        ScriptValues.toDouble(rhsV), op);
      }
      else if(ScriptValues.isNumber(lhsV) && ScriptValues.isStringValue(rhsV))
      {
        result = evalOp(ScriptValues.toDouble(lhsV),
                        ScriptValues.stringToDouble((String) rhsV, env), op);
      }
      else
      {
        throw new RuntimeError("Can't mix different types in a comparison. Left operand ["
                               + lhsV.getClass().getSimpleName() + "], right operand ["
                               + rhsV.getClass().getSimpleName() + "]");
      }

      if(!result)
      {
        return 0.0;
      }
      lhsV = rhsV;
    }
    return 1.0;
  }
}
