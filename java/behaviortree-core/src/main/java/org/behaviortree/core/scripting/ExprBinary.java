package org.behaviortree.core.scripting;

import org.behaviortree.core.RuntimeError;

final class ExprBinary implements Expr
{
  enum Op
  {
    PLUS, MINUS, TIMES, DIV, CONCAT, BIT_AND, BIT_OR, BIT_XOR, LOGIC_AND, LOGIC_OR
  }

  final Expr lhs;
  final Op op;
  final Expr rhs;

  ExprBinary(Expr lhs, Op op, Expr rhs)
  {
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  @Override
  public Object evaluate(Environment env)
  {
    Object lv = lhs.evaluate(env);
    Object rv = rhs.evaluate(env);

    if(lv == null)
    {
      throw new RuntimeError("The left operand of the operator [" + opStr() + "] is not "
                             + "initialized");
    }
    if(rv == null)
    {
      throw new RuntimeError("The right operand of the operator [" + opStr() + "] is not "
                             + "initialized");
    }

    if(ScriptValues.isNumber(rv) && ScriptValues.isNumber(lv))
    {
      double l = ScriptValues.toDouble(lv);
      double r = ScriptValues.toDouble(rv);
      switch(op)
      {
        case PLUS:
          return l + r;
        case MINUS:
          return l - r;
        case TIMES:
          return l * r;
        case DIV:
          return l / r;
        case BIT_AND:
        case BIT_OR:
        case BIT_XOR:
        {
          long li = ScriptValues.toInt64(lv);
          long ri = ScriptValues.toInt64(rv);
          if(op == Op.BIT_AND)
          {
            return (double) (li & ri);
          }
          if(op == Op.BIT_OR)
          {
            return (double) (li | ri);
          }
          return (double) (li ^ ri);
        }
        case LOGIC_AND:
          return (ScriptValues.toBoolean(lv) && ScriptValues.toBoolean(rv)) ? 1.0 : 0.0;
        case LOGIC_OR:
          return (ScriptValues.toBoolean(lv) || ScriptValues.toBoolean(rv)) ? 1.0 : 0.0;
        default:
          break;
        case CONCAT:
          return ScriptValues.toStringValue(lv) + ScriptValues.toStringValue(rv);
      }
    }
    else if(ScriptValues.isStringValue(lv) && ScriptValues.isStringValue(rv) && op == Op.PLUS)
    {
      return (String) lv + (String) rv;
    }
    else if(op == Op.CONCAT
            && ((ScriptValues.isStringValue(lv) && ScriptValues.isStringValue(rv))
                || (ScriptValues.isStringValue(lv) && ScriptValues.isNumber(rv))
                || (ScriptValues.isNumber(lv) && ScriptValues.isStringValue(rv))))
    {
      return ScriptValues.toStringValue(lv) + ScriptValues.toStringValue(rv);
    }
    else
    {
      throw new RuntimeError("Operation not permitted between the given operand types");
    }
    return null;
  }

  private String opStr()
  {
    switch(op)
    {
      case PLUS:
        return "+";
      case MINUS:
        return "-";
      case TIMES:
        return "*";
      case DIV:
        return "/";
      case CONCAT:
        return "..";
      case BIT_AND:
        return "&";
      case BIT_OR:
        return "|";
      case BIT_XOR:
        return "^";
      case LOGIC_AND:
        return "&&";
      case LOGIC_OR:
        return "||";
      default:
        return "";
    }
  }
}
