package org.behaviortree.core.scripting;

import java.util.ArrayList;
import java.util.List;
import org.behaviortree.core.RuntimeError;

/**
 * Parses the embedded scripting language (used by {@code <Script code="..."/>}, {@code
 * ScriptCondition}, the {@code Precondition} decorator, and the {@code _skipIf}/{@code _while}/...
 * node attributes) into a {@link ScriptFunction}. Hand-written Pratt (operator-precedence) parser,
 * mirroring BT.CPP's script_parser.cpp.
 */
public final class ScriptParser
{
  private ScriptParser()
  {}

  // Binding powers - higher binds tighter.
  private static final int ASSIGNMENT_BP = 2;
  private static final int TERNARY_BP = 4;
  private static final int COMPARISON_BP = 10;
  private static final int PREFIX_BP = 20;

  /** Compiles {@code script} into a reusable {@link ScriptFunction}. Throws {@link RuntimeError}
   * on a parse error or if the script is empty. */
  public static ScriptFunction parse(String script)
  {
    List<Expr> exprs = parseStatements(script);
    if(exprs.isEmpty())
    {
      throw new RuntimeError("Empty Script");
    }
    return (blackboard, enums) -> {
      Environment env = new Environment(blackboard, enums);
      try
      {
        for(int i = 0; i < exprs.size() - 1; i++)
        {
          exprs.get(i).evaluate(env);
        }
        return exprs.get(exprs.size() - 1).evaluate(env);
      }
      catch(RuntimeError err)
      {
        throw new RuntimeError("Error in script [" + script + "]\n" + err.getMessage());
      }
    };
  }

  /** Throws {@link RuntimeError} if {@code script} does not parse. */
  public static void validate(String script)
  {
    if(parseStatements(script).isEmpty())
    {
      throw new RuntimeError("Empty Script");
    }
  }

  static List<Expr> parseStatements(String script)
  {
    List<Token> tokens = Lexer.tokenize(script);
    return new Parser(tokens).parseAll();
  }

  private static final class Parser
  {
    private final List<Token> tokens;
    private int current = 0;

    Parser(List<Token> tokens)
    {
      this.tokens = tokens;
    }

    List<Expr> parseAll()
    {
      List<Expr> stmts = new ArrayList<>();
      while(!atEnd())
      {
        stmts.add(parseExpr(0));
        while(check(TokenType.SEMICOLON))
        {
          advance();
        }
      }
      return stmts;
    }

    private Token peek()
    {
      return tokens.get(current);
    }

    private Token advance()
    {
      Token t = tokens.get(current);
      if(!atEnd())
      {
        current++;
      }
      return t;
    }

    private boolean atEnd()
    {
      return peek().type == TokenType.END_OF_INPUT;
    }

    private boolean check(TokenType type)
    {
      return peek().type == type;
    }

    private Token expect(TokenType type, String msg)
    {
      if(!check(type))
      {
        throw new RuntimeError("Parse error at position " + peek().pos + ": " + msg
                               + " (got '" + peek().text + "')");
      }
      return advance();
    }

    private static int leftBP(TokenType type)
    {
      switch(type)
      {
        case COLON_EQUAL:
        case EQUAL:
        case PLUS_EQUAL:
        case MINUS_EQUAL:
        case STAR_EQUAL:
        case SLASH_EQUAL:
          return ASSIGNMENT_BP;
        case QUESTION:
          return TERNARY_BP;
        case PIPE_PIPE:
          return 6;
        case AMP_AMP:
          return 8;
        case EQUAL_EQUAL:
        case BANG_EQUAL:
        case LESS:
        case GREATER:
        case LESS_EQUAL:
        case GREATER_EQUAL:
          return COMPARISON_BP;
        case PIPE:
        case CARET:
          return 12;
        case AMPERSAND:
          return 14;
        case PLUS:
        case MINUS:
        case DOT_DOT:
          return 16;
        case STAR:
        case SLASH:
          return 18;
        default:
          return -1;
      }
    }

    private static boolean isComparison(TokenType type)
    {
      return type == TokenType.EQUAL_EQUAL || type == TokenType.BANG_EQUAL
             || type == TokenType.LESS || type == TokenType.GREATER
             || type == TokenType.LESS_EQUAL || type == TokenType.GREATER_EQUAL;
    }

    private static boolean isAssignment(TokenType type)
    {
      return type == TokenType.COLON_EQUAL || type == TokenType.EQUAL
             || type == TokenType.PLUS_EQUAL || type == TokenType.MINUS_EQUAL
             || type == TokenType.STAR_EQUAL || type == TokenType.SLASH_EQUAL;
    }

    private Expr parsePrefix()
    {
      Token tok = peek();

      if(tok.type == TokenType.MINUS)
      {
        advance();
        return new ExprUnary(ExprUnary.Op.NEGATE, parseExpr(PREFIX_BP));
      }
      if(tok.type == TokenType.TILDE)
      {
        advance();
        return new ExprUnary(ExprUnary.Op.COMPLEMENT, parseExpr(PREFIX_BP));
      }
      if(tok.type == TokenType.BANG)
      {
        advance();
        return new ExprUnary(ExprUnary.Op.LOGICAL_NOT, parseExpr(PREFIX_BP));
      }
      if(tok.type == TokenType.LEFT_PAREN)
      {
        advance();
        Expr expr = parseExpr(0);
        expect(TokenType.RIGHT_PAREN, "expected ')'");
        return expr;
      }
      if(tok.type == TokenType.BOOLEAN)
      {
        advance();
        return new ExprLiteral(tok.text.equals("true") ? 1.0 : 0.0);
      }
      if(tok.type == TokenType.INTEGER)
      {
        advance();
        long val;
        if(tok.text.length() > 2 && tok.text.charAt(0) == '0'
           && (tok.text.charAt(1) == 'x' || tok.text.charAt(1) == 'X'))
        {
          val = Long.parseLong(tok.text.substring(2), 16);
        }
        else
        {
          val = Long.parseLong(tok.text);
        }
        return new ExprLiteral((double) val);
      }
      if(tok.type == TokenType.REAL)
      {
        advance();
        return new ExprLiteral(Double.parseDouble(tok.text));
      }
      if(tok.type == TokenType.STRING)
      {
        advance();
        return new ExprLiteral(tok.text);
      }
      if(tok.type == TokenType.IDENTIFIER)
      {
        advance();
        return new ExprName(tok.text);
      }
      if(tok.type == TokenType.ERROR)
      {
        throw new RuntimeError("Invalid token '" + tok.text + "' at position " + tok.pos);
      }
      throw new RuntimeError("Expected operand at position " + tok.pos + " (got '" + tok.text
                             + "')");
    }

    private Expr parseExpr(int minBP)
    {
      Expr left = parsePrefix();

      while(true)
      {
        TokenType tokType = peek().type;
        int lbp = leftBP(tokType);
        if(lbp < 0 || lbp < minBP)
        {
          break;
        }

        if(isAssignment(tokType))
        {
          left = parseAssignment(left);
          break;
        }
        if(tokType == TokenType.QUESTION)
        {
          left = parseTernary(left);
          break;
        }
        if(isComparison(tokType))
        {
          left = parseChainedComparison(left);
          continue;
        }

        TokenType opType = advance().type;
        Expr right = parseExpr(lbp + 1);
        left = makeBinary(left, opType, right);
      }

      return left;
    }

    private Expr parseAssignment(Expr left)
    {
      TokenType opTok = advance().type;
      ExprAssignment.Op op;
      switch(opTok)
      {
        case COLON_EQUAL:
          op = ExprAssignment.Op.ASSIGN_CREATE;
          break;
        case EQUAL:
          op = ExprAssignment.Op.ASSIGN_EXISTING;
          break;
        case PLUS_EQUAL:
          op = ExprAssignment.Op.ASSIGN_PLUS;
          break;
        case MINUS_EQUAL:
          op = ExprAssignment.Op.ASSIGN_MINUS;
          break;
        case STAR_EQUAL:
          op = ExprAssignment.Op.ASSIGN_TIMES;
          break;
        case SLASH_EQUAL:
          op = ExprAssignment.Op.ASSIGN_DIV;
          break;
        default:
          throw new RuntimeError("Internal error: unexpected assignment op");
      }
      Expr right = parseExpr(0);
      return new ExprAssignment(left, op, right);
    }

    private Expr parseTernary(Expr condition)
    {
      advance();
      Expr thenExpr = parseExpr(0);
      expect(TokenType.COLON, "expected ':' in ternary expression");
      Expr elseExpr = parseExpr(TERNARY_BP);
      return new ExprIf(condition, thenExpr, elseExpr);
    }

    private Expr parseChainedComparison(Expr first)
    {
      ExprComparison node = new ExprComparison();
      node.operands.add(first);
      while(isComparison(peek().type))
      {
        node.ops.add(mapComparisonOp(advance().type));
        node.operands.add(parseExpr(COMPARISON_BP + 1));
      }
      return node;
    }

    private static ExprComparison.Op mapComparisonOp(TokenType type)
    {
      switch(type)
      {
        case EQUAL_EQUAL:
          return ExprComparison.Op.EQUAL;
        case BANG_EQUAL:
          return ExprComparison.Op.NOT_EQUAL;
        case LESS:
          return ExprComparison.Op.LESS;
        case GREATER:
          return ExprComparison.Op.GREATER;
        case LESS_EQUAL:
          return ExprComparison.Op.LESS_EQUAL;
        case GREATER_EQUAL:
          return ExprComparison.Op.GREATER_EQUAL;
        default:
          throw new RuntimeError("Internal error: not a comparison op");
      }
    }

    private static Expr makeBinary(Expr left, TokenType opType, Expr right)
    {
      ExprBinary.Op op;
      switch(opType)
      {
        case PLUS:
          op = ExprBinary.Op.PLUS;
          break;
        case MINUS:
          op = ExprBinary.Op.MINUS;
          break;
        case STAR:
          op = ExprBinary.Op.TIMES;
          break;
        case SLASH:
          op = ExprBinary.Op.DIV;
          break;
        case DOT_DOT:
          op = ExprBinary.Op.CONCAT;
          break;
        case AMPERSAND:
          op = ExprBinary.Op.BIT_AND;
          break;
        case PIPE:
          op = ExprBinary.Op.BIT_OR;
          break;
        case CARET:
          op = ExprBinary.Op.BIT_XOR;
          break;
        case AMP_AMP:
          op = ExprBinary.Op.LOGIC_AND;
          break;
        case PIPE_PIPE:
          op = ExprBinary.Op.LOGIC_OR;
          break;
        default:
          throw new RuntimeError("Internal error: unknown binary operator");
      }
      return new ExprBinary(left, op, right);
    }
  }
}
