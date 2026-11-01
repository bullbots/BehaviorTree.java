// NodeStatus + errors + virtual clock (mirrors org.behaviortree.core basic types)
export const STATUS = Object.freeze({
  IDLE: 'IDLE', RUNNING: 'RUNNING', SUCCESS: 'SUCCESS', FAILURE: 'FAILURE', SKIPPED: 'SKIPPED',
});
export const isCompleted = (s) => s === STATUS.SUCCESS || s === STATUS.FAILURE;
export const isActive = (s) => s !== STATUS.IDLE && s !== STATUS.SKIPPED;

export class BTError extends Error {
  constructor(msg, kind) { super(msg); this.name = kind || 'BehaviorTreeException'; this.kind = kind || 'BehaviorTreeException'; }
}
export const LogicError = (msg) => new BTError(msg, 'LogicError');
export const RuntimeError2 = (msg) => new BTError(msg, 'RuntimeError');

/** Virtual clock: 1 tick = CLOCK_TICK_NS. Fidelity note: Timeout/Delay/Sleep in the Java port
 *  are poll-based (checked once per tick) — we replicate that, but with a deterministic virtual
 *  clock so exercises are reproducible and fast. */
export const CLOCK_TICK_NS = 50_000_000n; // 50 ms per tick
let currentNanos = 0n;
export const simClock = {
  reset() { currentNanos = 0n; },
  now() { return currentNanos; },
  advanceTick() { currentNanos += CLOCK_TICK_NS; },
  get ms() { return Number(currentNanos / 1_000_000n); },
  /** Timestamp at the START of the current simulated tick (now() minus one tick, floored at 0).
   *  Polled decorators (Timeout/Delay/Sleep) anchor their deadline here, so elapsed time is a
   *  whole number of ticks: msec="300" fires on the tick where 300ms have fully elapsed (tick 6),
   *  Delay delay_msec="200" ticks its child on tick 4. */
  startOfTick() { const t = currentNanos - CLOCK_TICK_NS; return t >= 0n ? t : 0n; },
};
