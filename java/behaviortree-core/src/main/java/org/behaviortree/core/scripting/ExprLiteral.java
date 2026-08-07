package org.behaviortree.core.scripting;

final class ExprLiteral implements Expr
{
  final Object value;

  ExprLiteral(Object value)
  {
    this.value = value;
  }

  @Override
  public Object evaluate(Environment env)
  {
    return value;
  }
}
