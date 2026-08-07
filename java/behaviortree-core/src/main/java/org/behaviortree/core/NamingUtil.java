package org.behaviortree.core;

/** Port/attribute name validation, mirroring BT.CPP's basic_types.cpp. */
public final class NamingUtil
{
  private NamingUtil()
  {}

  private static final String FORBIDDEN_CHARS = " \t\n\r<>&\"'/\\:*?|.";

  public static boolean isAllowedPortName(String name)
  {
    if(name == null || name.isEmpty())
    {
      return false;
    }
    if(!Character.isAlphabetic(name.charAt(0)))
    {
      return false;
    }
    if(findForbiddenChar(name) != '\0')
    {
      return false;
    }
    return !isReservedAttribute(name);
  }

  public static boolean isReservedAttribute(String name)
  {
    for(PreCond cond : PreCond.values())
    {
      if(cond.attributeName().equals(name))
      {
        return true;
      }
    }
    for(PostCond cond : PostCond.values())
    {
      if(cond.attributeName().equals(name))
      {
        return true;
      }
    }
    return name.equals("name") || name.equals("ID") || name.equals("_autoremap");
  }

  /** Returns the first forbidden character in {@code name}, or {@code '\0'} if it is valid. */
  public static char findForbiddenChar(String name)
  {
    for(int i = 0; i < name.length(); i++)
    {
      char c = name.charAt(i);
      if(c >= 0x80)
      {
        continue;
      }
      if(c < 32 || c == 127)
      {
        return c;
      }
      if(FORBIDDEN_CHARS.indexOf(c) >= 0)
      {
        return c;
      }
    }
    return '\0';
  }
}
