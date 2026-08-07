package org.behaviortree.core.scripting;

import org.behaviortree.core.RuntimeError;

final class ExprUnary implements Expr
{
  enum Op
  {
    NEGATE, COMPLEMENT, LOGICAL_NOT
  }

  final Op op;
  final Expr rhs;

  ExprUnary(Op op, Expr rhs)
  {
    this.op = op;
    this.rhs = rhs;
  }

  @Override
  public Object evaluate(Environment env)
  {
    Object rv = rhs.evaluate(env);
    if(ScriptValues.isNumber(rv))
    {
      double d = ScriptValues.toDouble(rv);
      switch(op)
      {
        case NEGATE:
          return -d;
        case COMPLEMENT:
          if(d > (double) Long.MAX_VALUE || d < (double) Long.MIN_VALUE)
          {
            throw new RuntimeError("Number out of range for bitwise operation");
          }
          return (double) (~(long) d);
        case LOGICAL_NOT:
          return (d == 0.0) ? 1.0 : 0.0;
        default:
          break;
      }
    }
    else if(ScriptValues.isStringValue(rv))
    {
      throw new RuntimeError("Invalid operator for string");
    }
    throw new RuntimeError("ExprUnary: undefined");
  }
}
