package org.behaviortree.core.scripting;

import org.behaviortree.core.Blackboard;
import org.behaviortree.core.RuntimeError;
import org.behaviortree.core.TypeInfo;

final class ExprAssignment implements Expr
{
  enum Op
  {
    ASSIGN_CREATE, ASSIGN_EXISTING, ASSIGN_PLUS, ASSIGN_MINUS, ASSIGN_TIMES, ASSIGN_DIV
  }

  private final Expr lhs;
  private final Op op;
  private final Expr rhs;

  ExprAssignment(Expr lhs, Op op, Expr rhs)
  {
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  @Override
  public Object evaluate(Environment env)
  {
    if(!(lhs instanceof ExprName exprName))
    {
      throw new RuntimeError("Assignment left operand not a blackboard entry");
    }
    String key = exprName.name;
    Blackboard bb = env.vars;
    Blackboard.Entry entry = bb.getEntry(key);
    if(entry == null)
    {
      if(op == Op.ASSIGN_CREATE)
      {
        bb.createEntry(key, new TypeInfo());
        entry = bb.getEntry(key);
      }
      else
      {
        throw new RuntimeError("The blackboard entry [" + key + "] doesn't exist, yet.\n"
                               + "If you want to create a new one, use the operator [:=] "
                               + "instead of [=]");
      }
    }

    Object value = rhs.evaluate(env);
    if(value == null)
    {
      throw new RuntimeError("The right operand of the operator [" + opStr() + "] is not "
                             + "initialized");
    }

    if(op == Op.ASSIGN_CREATE || op == Op.ASSIGN_EXISTING)
    {
      bb.set(key, value);
      return bb.getEntry(key).value;
    }

    Object current;
    synchronized(entry.lock)
    {
      current = entry.value;
    }
    if(current == null)
    {
      throw new RuntimeError("The left operand of the operator [" + opStr() + "] is not "
                             + "initialized");
    }

    Object newValue;
    if(ScriptValues.isNumber(value))
    {
      if(!ScriptValues.isNumber(current))
      {
        throw new RuntimeError("This assignment operator can't be used with a non-numeric "
                               + "type");
      }
      double l = ScriptValues.toDouble(current);
      double r = ScriptValues.toDouble(value);
      switch(op)
      {
        case ASSIGN_PLUS:
          newValue = l + r;
          break;
        case ASSIGN_MINUS:
          newValue = l - r;
          break;
        case ASSIGN_TIMES:
          newValue = l * r;
          break;
        case ASSIGN_DIV:
          newValue = l / r;
          break;
        default:
          throw new RuntimeError("Internal error: unexpected assignment op");
      }
    }
    else if(ScriptValues.isStringValue(value))
    {
      if(op != Op.ASSIGN_PLUS)
      {
        throw new RuntimeError("Operator not supported for strings");
      }
      newValue = ScriptValues.toStringValue(current) + value;
    }
    else
    {
      throw new RuntimeError("Unsupported operand type for compound assignment");
    }

    bb.set(key, newValue);
    return bb.getEntry(key).value;
  }

  private String opStr()
  {
    switch(op)
    {
      case ASSIGN_CREATE:
        return ":=";
      case ASSIGN_EXISTING:
        return "=";
      case ASSIGN_PLUS:
        return "+=";
      case ASSIGN_MINUS:
        return "-=";
      case ASSIGN_TIMES:
        return "*=";
      case ASSIGN_DIV:
        return "/=";
      default:
        return "";
    }
  }
}
