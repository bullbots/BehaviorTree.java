package org.behaviortree.core.scripting;

final class ExprName implements Expr
{
  final String name;

  ExprName(String name)
  {
    this.name = name;
  }

  @Override
  public Object evaluate(Environment env)
  {
    return ScriptValues.lookupVariable(name, env);
  }
}
