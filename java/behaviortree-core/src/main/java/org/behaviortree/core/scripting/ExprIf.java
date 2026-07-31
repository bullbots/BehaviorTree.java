package org.behaviortree.core.scripting;

final class ExprIf implements Expr
{
  private final Expr condition;
  private final Expr thenExpr;
  private final Expr elseExpr;

  ExprIf(Expr condition, Expr thenExpr, Expr elseExpr)
  {
    this.condition = condition;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
  }

  @Override
  public Object evaluate(Environment env)
  {
    Object v = condition.evaluate(env);
    boolean valid = (v instanceof String s && !s.isEmpty()) || ScriptValues.toDouble(v) != 0.0;
    return valid ? thenExpr.evaluate(env) : elseExpr.evaluate(env);
  }
}
