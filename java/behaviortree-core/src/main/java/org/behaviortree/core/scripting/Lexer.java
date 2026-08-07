package org.behaviortree.core.scripting;

import java.util.ArrayList;
import java.util.List;

/** Hand-written tokenizer for the embedded scripting language, mirroring BT.CPP's
 * script_tokenizer.cpp. */
final class Lexer
{
  private Lexer()
  {}

  private static boolean isIdentStart(char c)
  {
    return Character.isLetter(c) || c == '_' || c == '@';
  }

  private static boolean isIdentChar(char c)
  {
    return Character.isLetterOrDigit(c) || c == '_';
  }

  private static boolean isDigit(char c)
  {
    return c >= '0' && c <= '9';
  }

  private static boolean isHexDigit(char c)
  {
    return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }

  private static final class NumberResult
  {
    boolean isReal = false;
    boolean hasError = false;
  }

  private static final class Cursor
  {
    final String src;
    int i;

    Cursor(String src, int i)
    {
      this.src = src;
      this.i = i;
    }

    int len()
    {
      return src.length();
    }

    char at(int idx)
    {
      return src.charAt(idx);
    }
  }

  private static void consumeTrailingGarbage(Cursor c)
  {
    while(c.i < c.len() && (isIdentChar(c.at(c.i)) || c.at(c.i) == '.'))
    {
      c.i++;
    }
  }

  private static NumberResult scanHexNumber(Cursor c)
  {
    NumberResult r = new NumberResult();
    c.i += 2;
    if(c.i >= c.len() || !isHexDigit(c.at(c.i)))
    {
      r.hasError = true;
    }
    else
    {
      while(c.i < c.len() && isHexDigit(c.at(c.i)))
      {
        c.i++;
      }
    }
    if(c.i < c.len() && (c.at(c.i) == '.' || isIdentChar(c.at(c.i))))
    {
      r.hasError = true;
      consumeTrailingGarbage(c);
    }
    return r;
  }

  private static NumberResult scanDecimalNumber(Cursor c)
  {
    NumberResult r = new NumberResult();
    while(c.i < c.len() && isDigit(c.at(c.i)))
    {
      c.i++;
    }
    if(c.i < c.len() && c.at(c.i) == '.')
    {
      if(c.i + 1 < c.len() && c.at(c.i + 1) == '.')
      {
        // leave the ".." concat operator alone
      }
      else if(c.i + 1 < c.len() && isDigit(c.at(c.i + 1)))
      {
        r.isReal = true;
        c.i++;
        while(c.i < c.len() && isDigit(c.at(c.i)))
        {
          c.i++;
        }
      }
      else
      {
        r.hasError = true;
        c.i++;
        consumeTrailingGarbage(c);
      }
    }
    if(!r.hasError && c.i < c.len() && (c.at(c.i) == 'e' || c.at(c.i) == 'E'))
    {
      r.isReal = true;
      c.i++;
      if(c.i < c.len() && (c.at(c.i) == '+' || c.at(c.i) == '-'))
      {
        c.i++;
      }
      if(c.i >= c.len() || !isDigit(c.at(c.i)))
      {
        r.hasError = true;
      }
      else
      {
        while(c.i < c.len() && isDigit(c.at(c.i)))
        {
          c.i++;
        }
      }
    }
    if(!r.hasError && c.i < c.len() && isIdentStart(c.at(c.i)))
    {
      r.hasError = true;
      while(c.i < c.len() && isIdentChar(c.at(c.i)))
      {
        c.i++;
      }
    }
    return r;
  }

  private static TokenType matchTwoCharOp(char c, char next)
  {
    if(c == '.' && next == '.')
      return TokenType.DOT_DOT;
    if(c == '&' && next == '&')
      return TokenType.AMP_AMP;
    if(c == '|' && next == '|')
      return TokenType.PIPE_PIPE;
    if(c == '=' && next == '=')
      return TokenType.EQUAL_EQUAL;
    if(c == '!' && next == '=')
      return TokenType.BANG_EQUAL;
    if(c == '<' && next == '=')
      return TokenType.LESS_EQUAL;
    if(c == '>' && next == '=')
      return TokenType.GREATER_EQUAL;
    if(c == ':' && next == '=')
      return TokenType.COLON_EQUAL;
    if(c == '+' && next == '=')
      return TokenType.PLUS_EQUAL;
    if(c == '-' && next == '=')
      return TokenType.MINUS_EQUAL;
    if(c == '*' && next == '=')
      return TokenType.STAR_EQUAL;
    if(c == '/' && next == '=')
      return TokenType.SLASH_EQUAL;
    return TokenType.ERROR;
  }

  private static TokenType matchSingleCharOp(char c)
  {
    switch(c)
    {
      case '+':
        return TokenType.PLUS;
      case '-':
        return TokenType.MINUS;
      case '*':
        return TokenType.STAR;
      case '/':
        return TokenType.SLASH;
      case '&':
        return TokenType.AMPERSAND;
      case '|':
        return TokenType.PIPE;
      case '^':
        return TokenType.CARET;
      case '~':
        return TokenType.TILDE;
      case '!':
        return TokenType.BANG;
      case '<':
        return TokenType.LESS;
      case '>':
        return TokenType.GREATER;
      case '=':
        return TokenType.EQUAL;
      case '?':
        return TokenType.QUESTION;
      case ':':
        return TokenType.COLON;
      case '(':
        return TokenType.LEFT_PAREN;
      case ')':
        return TokenType.RIGHT_PAREN;
      case ';':
        return TokenType.SEMICOLON;
      default:
        return TokenType.ERROR;
    }
  }

  static List<Token> tokenize(String source)
  {
    List<Token> tokens = new ArrayList<>();
    Cursor c = new Cursor(source, 0);
    int len = c.len();

    while(c.i < len)
    {
      char ch = c.at(c.i);

      if(ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r')
      {
        c.i++;
        continue;
      }

      int start = c.i;

      if(ch == '\'')
      {
        c.i++;
        while(c.i < len && c.at(c.i) != '\'')
        {
          c.i++;
        }
        if(c.i < len)
        {
          String text = source.substring(start + 1, c.i);
          tokens.add(new Token(TokenType.STRING, text, start));
          c.i++;
        }
        else
        {
          tokens.add(new Token(TokenType.ERROR, source.substring(start, c.i), start));
        }
        continue;
      }

      if(isDigit(ch))
      {
        boolean isHex = ch == '0' && c.i + 1 < len
                        && (c.at(c.i + 1) == 'x' || c.at(c.i + 1) == 'X');
        NumberResult nr = isHex ? scanHexNumber(c) : scanDecimalNumber(c);
        String text = source.substring(start, c.i);
        if(nr.hasError)
        {
          tokens.add(new Token(TokenType.ERROR, text, start));
        }
        else if(nr.isReal)
        {
          tokens.add(new Token(TokenType.REAL, text, start));
        }
        else
        {
          tokens.add(new Token(TokenType.INTEGER, text, start));
        }
        continue;
      }

      if(isIdentStart(ch))
      {
        c.i++;
        while(c.i < len && isIdentChar(c.at(c.i)))
        {
          c.i++;
        }
        String text = source.substring(start, c.i);
        if(text.equals("true") || text.equals("false"))
        {
          tokens.add(new Token(TokenType.BOOLEAN, text, start));
        }
        else
        {
          tokens.add(new Token(TokenType.IDENTIFIER, text, start));
        }
        continue;
      }

      if(c.i + 1 < len)
      {
        TokenType twoChar = matchTwoCharOp(ch, c.at(c.i + 1));
        if(twoChar != TokenType.ERROR)
        {
          tokens.add(new Token(twoChar, source.substring(start, start + 2), start));
          c.i += 2;
          continue;
        }
      }

      tokens.add(new Token(matchSingleCharOp(ch), String.valueOf(ch), start));
      c.i++;
    }

    tokens.add(new Token(TokenType.END_OF_INPUT, "", c.i));
    return tokens;
  }
}
