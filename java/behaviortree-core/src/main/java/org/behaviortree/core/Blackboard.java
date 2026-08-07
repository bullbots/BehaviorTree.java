package org.behaviortree.core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/** The mechanism used by behavior trees to exchange typed data between nodes. */
public final class Blackboard
{
  /** A single named value stored in a blackboard, with its declared type and write history. */
  public static final class Entry
  {
    public final Object lock = new Object();
    public Object value;
    public TypeInfo info;
    public long sequenceId = 0;
    public long stampNanos = 0;

    Entry(TypeInfo info)
    {
      this.info = info;
    }
  }

  private final ReentrantReadWriteLock storageLock = new ReentrantReadWriteLock();
  private final Map<String, Entry> storage = new LinkedHashMap<>();
  private final Blackboard parent;
  private final Map<String, String> internalToExternal = new HashMap<>();
  private volatile boolean autoRemapping = false;

  private Blackboard(Blackboard parent)
  {
    this.parent = parent;
  }

  public static Blackboard create()
  {
    return new Blackboard(null);
  }

  public static Blackboard create(Blackboard parent)
  {
    return new Blackboard(parent);
  }

  public void enableAutoRemapping(boolean remapping)
  {
    this.autoRemapping = remapping;
  }

  public Blackboard parent()
  {
    return parent;
  }

  public Blackboard rootBlackboard()
  {
    Blackboard bb = this;
    while(bb.parent != null)
    {
      bb = bb.parent;
    }
    return bb;
  }

  private static boolean isPrivateKey(String key)
  {
    return !key.isEmpty() && key.charAt(0) == '_';
  }

  /** Looks up an entry, following subtree remapping / autoremapping to the parent blackboard. */
  public Entry getEntry(String key)
  {
    if(key.startsWith("@"))
    {
      return rootBlackboard().getEntry(key.substring(1));
    }

    storageLock.readLock().lock();
    Entry local;
    try
    {
      local = storage.get(key);
    }
    finally
    {
      storageLock.readLock().unlock();
    }
    if(local != null)
    {
      return local;
    }
    if(parent != null)
    {
      String remapped = internalToExternal.get(key);
      if(remapped != null)
      {
        return parent.getEntry(remapped);
      }
      if(autoRemapping && !isPrivateKey(key))
      {
        return parent.getEntry(key);
      }
    }
    return null;
  }

  public TypeInfo entryInfo(String key)
  {
    Entry e = getEntry(key);
    return e == null ? null : e.info;
  }

  public void addSubtreeRemapping(String internalKey, String externalKey)
  {
    internalToExternal.put(internalKey, externalKey);
  }

  /** Returns true and populates the entry if present and initialized. */
  @SuppressWarnings("unchecked")
  public <T> boolean get(String key, Class<T> type, java.util.function.Consumer<T> out)
  {
    Entry e = getEntry(key);
    if(e == null)
    {
      return false;
    }
    synchronized(e.lock)
    {
      if(e.value == null)
      {
        return false;
      }
      out.accept((T) castValue(e, type, key));
    }
    return true;
  }

  public <T> Optional<T> tryGet(String key, Class<T> type)
  {
    Entry e = getEntry(key);
    if(e == null)
    {
      return Optional.empty();
    }
    synchronized(e.lock)
    {
      if(e.value == null)
      {
        return Optional.empty();
      }
      return Optional.ofNullable(castValue(e, type, key));
    }
  }

  public <T> T get(String key, Class<T> type)
  {
    Entry e = getEntry(key);
    if(e == null)
    {
      throw new RuntimeError("Blackboard::get() error. Missing key [" + key + "]");
    }
    synchronized(e.lock)
    {
      if(e.value == null)
      {
        throw new RuntimeError("Blackboard::get() error. Entry [" + key
                               + "] hasn't been initialized, yet");
      }
      return castValue(e, type, key);
    }
  }

  public <T> Optional<StampedValue<T>> tryGetStamped(String key, Class<T> type)
  {
    Entry e = getEntry(key);
    if(e == null)
    {
      return Optional.empty();
    }
    synchronized(e.lock)
    {
      if(e.value == null)
      {
        return Optional.empty();
      }
      T v = castValue(e, type, key);
      return Optional.of(new StampedValue<>(v, new Timestamp(e.sequenceId, e.stampNanos)));
    }
  }

  @SuppressWarnings("unchecked")
  private <T> T castValue(Entry e, Class<T> type, String key)
  {
    Object v = e.value;
    if(type == Object.class || type.isInstance(v))
    {
      return (T) v;
    }
    if(v instanceof String s && type != String.class)
    {
      return Conversions.convertFromString(type, s);
    }
    if(v instanceof Number n && NumericCast.isNumeric(type))
    {
      return (T) coerceNumber(n, type);
    }
    throw new RuntimeError("Blackboard entry [" + key + "] has type [" + v.getClass().getName()
                           + "] which cannot be converted to [" + type.getName() + "]");
  }

  @SuppressWarnings("unchecked")
  private static <T> T coerceNumber(Number n, Class<T> type)
  {
    if(type == Integer.class || type == int.class)
    {
      return (T) Integer.valueOf(n.intValue());
    }
    if(type == Long.class || type == long.class)
    {
      return (T) Long.valueOf(n.longValue());
    }
    if(type == Short.class || type == short.class)
    {
      return (T) Short.valueOf(n.shortValue());
    }
    if(type == Byte.class || type == byte.class)
    {
      return (T) Byte.valueOf(n.byteValue());
    }
    if(type == Float.class || type == float.class)
    {
      return (T) Float.valueOf(n.floatValue());
    }
    if(type == Double.class || type == double.class)
    {
      return (T) Double.valueOf(n.doubleValue());
    }
    throw new RuntimeError("Cannot coerce number to " + type.getName());
  }

  /** Updates (or creates) an entry. Once an entry has a strong type, later sets must match it. */
  public <T> void set(String key, T value)
  {
    if(key.startsWith("@"))
    {
      rootBlackboard().set(key.substring(1), value);
      return;
    }

    Entry entry;
    storageLock.readLock().lock();
    try
    {
      entry = storage.get(key);
    }
    finally
    {
      storageLock.readLock().unlock();
    }

    if(entry == null)
    {
      Class<?> valueType = value == null ? TypeInfo.ANY_TYPE : value.getClass();
      TypeInfo info = (value instanceof String) ? new TypeInfo() : new TypeInfo(valueType);
      entry = createEntryImpl(key, info);
    }

    synchronized(entry.lock)
    {
      if(!entry.info.isStronglyTyped())
      {
        entry.info = new TypeInfo(value == null ? TypeInfo.ANY_TYPE : value.getClass());
        entry.value = value;
        entry.sequenceId++;
        entry.stampNanos = System.nanoTime();
        return;
      }

      Class<?> previousType = entry.info.type();
      Class<?> newType = value == null ? previousType : value.getClass();

      if(!previousType.isAssignableFrom(newType) && !newType.isAssignableFrom(previousType))
      {
        boolean mismatching = true;
        if(value instanceof String s)
        {
          try
          {
            Object parsed = entry.info.parseString(s);
            if(parsed != null)
            {
              mismatching = false;
              value = (T) parsed;
            }
          }
          catch(RuntimeException ignored)
          {
            // not parseable as the entry's declared type; fall through to the mismatch error
          }
        }
        else if(value instanceof Number n && NumericCast.isNumeric(previousType)
                && NumericCast.isSafe(previousType, n))
        {
          mismatching = false;
        }
        if(mismatching)
        {
          throw new LogicError("Blackboard::set(" + key + "): once declared, the type of a port "
                               + "shall not change. Previously declared type ["
                               + previousType.getName() + "], current type ["
                               + (value == null ? "null" : value.getClass().getName()) + "]");
        }
      }
      entry.value = value;
      entry.sequenceId++;
      entry.stampNanos = System.nanoTime();
    }
  }

  public void unset(String key)
  {
    storageLock.writeLock().lock();
    try
    {
      storage.remove(key);
    }
    finally
    {
      storageLock.writeLock().unlock();
    }
  }

  public void createEntry(String key, TypeInfo info)
  {
    if(key.startsWith("@"))
    {
      if(key.indexOf('@', 1) >= 0)
      {
        throw new LogicError("Character '@' used multiple times in the key");
      }
      rootBlackboard().createEntryImpl(key.substring(1), info);
    }
    else
    {
      createEntryImpl(key, info);
    }
  }

  private Entry createEntryImpl(String key, TypeInfo info)
  {
    storageLock.writeLock().lock();
    try
    {
      Entry existing = storage.get(key);
      if(existing != null)
      {
        TypeInfo prev = existing.info;
        if(prev.type() != info.type() && prev.isStronglyTyped() && info.isStronglyTyped())
        {
          throw new LogicError("Blackboard entry [" + key + "]: once declared, the type of a "
                               + "port shall not change. Previously declared type ["
                               + prev.type().getName() + "], current type ["
                               + info.type().getName() + "]");
        }
        return existing;
      }

      String remapped = internalToExternal.get(key);
      if(remapped != null)
      {
        if(parent == null)
        {
          throw new RuntimeError("Missing parent blackboard");
        }
        return parent.createEntryImpl(remapped, info);
      }
      if(autoRemapping && !isPrivateKey(key))
      {
        if(parent == null)
        {
          throw new RuntimeError("Missing parent blackboard");
        }
        return parent.createEntryImpl(key, info);
      }

      Entry entry = new Entry(info);
      storage.put(key, entry);
      return entry;
    }
    finally
    {
      storageLock.writeLock().unlock();
    }
  }

  public List<String> getKeys()
  {
    storageLock.readLock().lock();
    try
    {
      return new ArrayList<>(storage.keySet());
    }
    finally
    {
      storageLock.readLock().unlock();
    }
  }

  public void debugMessage(java.io.PrintStream out)
  {
    storageLock.readLock().lock();
    try
    {
      for(Map.Entry<String, Entry> e : storage.entrySet())
      {
        Class<?> type = e.getValue().info.type();
        if(type == TypeInfo.ANY_TYPE && e.getValue().value != null)
        {
          type = e.getValue().value.getClass();
        }
        out.println(e.getKey() + " (" + type.getName() + ")");
      }
    }
    finally
    {
      storageLock.readLock().unlock();
    }
    for(Map.Entry<String, String> e : internalToExternal.entrySet())
    {
      out.println("[" + e.getKey() + "] remapped to port of parent tree [" + e.getValue() + "]");
    }
  }

  /** Copies the value/type of every entry in this blackboard into {@code dst}, creating entries
   * that don't already exist there and removing entries in {@code dst} that no longer exist here. */
  public void cloneInto(Blackboard dst)
  {
    Set<String> dstKeysToRemove;
    Map<String, Entry> srcSnapshot;
    storageLock.readLock().lock();
    try
    {
      srcSnapshot = new LinkedHashMap<>(storage);
    }
    finally
    {
      storageLock.readLock().unlock();
    }
    dst.storageLock.writeLock().lock();
    try
    {
      dstKeysToRemove = new HashSet<>(dst.storage.keySet());
      dstKeysToRemove.removeAll(srcSnapshot.keySet());

      for(Map.Entry<String, Entry> src : srcSnapshot.entrySet())
      {
        Entry dstEntry = dst.storage.get(src.getKey());
        if(dstEntry == null)
        {
          dstEntry = new Entry(src.getValue().info);
          dst.storage.put(src.getKey(), dstEntry);
        }
        synchronized(src.getValue().lock)
        {
          synchronized(dstEntry.lock)
          {
            dstEntry.info = src.getValue().info;
            dstEntry.value = src.getValue().value;
            dstEntry.sequenceId++;
            dstEntry.stampNanos = System.nanoTime();
          }
        }
      }
      for(String key : dstKeysToRemove)
      {
        dst.storage.remove(key);
      }
    }
    finally
    {
      dst.storageLock.writeLock().unlock();
    }
  }
}
