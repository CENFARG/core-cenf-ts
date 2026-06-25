# Audit: core-cenf-ts Runtime Failure Patterns

**Date**: 2026-06-25
**Scope**: `src/` (all 19 managers + shared utilities)
**Version**: v0.2.0 (708 tests)

---

## Issue 1: Infinite Recursion — Bootstrap Self-Registration

**Severity**: 🔴 CRITICAL
**Category**: Deadlock / Stack Overflow

### Root Cause
In `StandardBootstrapAdapter.start()`, the method resets `this.started = []` at the top and iterates the registry. If the bootstrap orchestrator is registered with itself (which the integration test at `bootstrap.integration.test.ts` does), calling `start()` causes infinite recursion:

1. `start()` iterates registry → reaches the "bootstrap" entry
2. Calls `entry.manager.start()` → **which is `this.start()` itself**
3. Step 1 repeats → `started = []` overwrites, losing track of all previously started managers
4. Re-starts all managers from scratch → reaches bootstrap again → **infinite loop**

**Files affected**:
- `src/managers/bootstrap/adapters/standard.adapter.ts` (lines 62-90)
- `src/managers/bootstrap/__tests__/bootstrap.integration.test.ts` (line 107 — self-registration, test is `describe.skip`)

### Reproduction
```typescript
const bootstrap = new StandardBootstrapAdapter();
bootstrap.register(mockManager, { priority: 1, name: 'config' });
bootstrap.register(bootstrap, { priority: 100, name: 'bootstrap' });
await bootstrap.start(); // Stack overflow / infinite recursion
```

### Code Fix
Add a guard at the top of `start()` and prevent self-registration:
```typescript
// In register():
if (manager === this) {
  throw new BootstrapError('The bootstrap orchestrator cannot register itself.');
}

// In start() — guard against re-entry:
async start(): Promise<void> {
  if (this.isStarted) return; // Already started — idempotent
  this.started = [];
  // ... rest
}
```

### Prevention
- Add `isStarted` check at top of `start()`
- Reject self-registration in `register()`
- Lint rule: `no-recursive-bootstrap-registration`

---

## Issue 2: RedisCacheAdapter — Event Listener Memory Leak

**Severity**: 🟠 HIGH
**Category**: Memory Leak / Resource Accumulation

### Root Cause
In `RedisCacheAdapter.start()` (line 161), a persistent `'error'` event listener is registered on the Redis client:
```typescript
this.redis.on('error', () => { this.connected = false; });
```
But `stop()` never calls `this.redis.off('error', ...)`. Each `start()` call adds a new listener. On repeated start/stop cycles (e.g., in tests, reconnect logic), listeners accumulate indefinitely. Additionally, the error is silently swallowed — no logging, no metric emission.

**Files affected**:
- `src/managers/cache/adapters/redis.adapter.ts` (lines 158-169, 171-181)

### Reproduction
```typescript
const adapter = new RedisCacheAdapter({ url: 'redis://localhost:6379' });
for (let i = 0; i < 1000; i++) {
  await adapter.start();  // adds error listener #i
  await adapter.stop();   // doesn't remove it
}
// 1000 error listeners alive on the same (discarded) Redis instance
```

### Code Fix
Store the handler reference and remove it in `stop()`:
```typescript
private errorHandler: (() => void) | null = null;

async start(): Promise<void> {
  try {
    this.redis = new Redis(this.url);
    this.errorHandler = () => { this.connected = false; };
    this.redis.on('error', this.errorHandler);
    await this.redis.ping();
    this.connected = true;
  } catch { /* ... */ }
}

async stop(): Promise<void> {
  if (this.redis) {
    if (this.errorHandler) {
      this.redis.off('error', this.errorHandler);
      this.errorHandler = null;
    }
    try { await this.redis.quit(); } catch { this.redis.disconnect(); }
    this.redis = null;
  }
  this.connected = false;
}
```

### Prevention
- ESLint rule: require `.off()` for every `.on()` in the same lifecycle scope
- Integration test that validates listener count (`this.redis.listenerCount('error')` === 0 after stop)
- Add `redis.on('error')` to observability/logging

---

## Issue 3: Cache Stampede — Single-Flight Race Condition

**Severity**: 🟠 HIGH
**Category**: Race Condition / Cache Integrity

### Root Cause
In both `MemoryCacheAdapter.getOrSet()` and `RedisCacheAdapter.getOrSet()`, concurrent calls for the same key defeat stampede protection.

**MemoryCacheAdapter** (lines 91-117): No single-flight lock at all. Multiple concurrent callers within the stampede window each independently invoke `computeAndStore()`. The factory runs N times instead of 1 — this is a **thundering herd in local concurrency**.

**RedisCacheAdapter** (lines 102-120): Has a `pendingGets` Map for single-flight, but the check-then-set pattern is not atomic:
```typescript
const pending = this.pendingGets.get(key);  // T1: undefined
if (pending !== undefined) return pending;
const promise = this._getOrSetImpl(...);     // T1: creates promise
this.pendingGets.set(key, promise);          // T1: sets
```
If two callers arrive between `.get()` and `.set()`:
1. T1: `.get(key)` → undefined
2. T2: `.get(key)` → undefined
3. T1: creates `promiseA`, sets it
4. T2: creates `promiseB`, **overwrites** T1's entry
5. Both `promiseA` and `promiseB` execute the factory independently

**Files affected**:
- `src/managers/cache/adapters/memory.adapter.ts` (lines 91-117)
- `src/managers/cache/adapters/redis.adapter.ts` (lines 102-120)

### Reproduction (Redis)
```typescript
// Concurrent getOrSet for the same key
await Promise.all([
  cache.getOrSet('key', expensiveFactory, 10000),
  cache.getOrSet('key', expensiveFactory, 10000),
  cache.getOrSet('key', expensiveFactory, 10000),
]);
// expensiveFactory may be called up to 3 times instead of 1
```

### Code Fix
Use a lock per key instead of a simple Map:
```typescript
// RedisCacheAdapter — atomic check-and-set
async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
  const existing = this.pendingGets.get(key);
  if (existing !== undefined) return existing as Promise<T>;

  const promise = this._getOrSetImpl(key, factory, ttlMs);
  // Re-check after setting — another caller may have beaten us
  if (this.pendingGets.has(key)) {
    return this.pendingGets.get(key) as Promise<T>;
  }
  this.pendingGets.set(key, promise);
  try {
    return await promise;
  } finally {
    this.pendingGets.delete(key);
  }
}
```

For MemoryCacheAdapter: add the same `pendingGets` Map pattern.

### Prevention
- Unit test: `Promise.all([getOrSet(...), getOrSet(...)])` verifies factory is called **exactly once**
- Use `vi.fn()` to count factory invocations in concurrent scenarios

---

## Issue 4: MemoryCacheAdapter XFetch — Deterministic Early Recompute (Not Probabilistic)

**Severity**: 🟡 MEDIUM
**Category**: Correctness / Stampede Protection

### Root Cause
True XFetch (from the Redis/Memcached research) uses **probabilistic** early recompute: `delta < window * log(random) / -beta`. This ensures only ONE request per window triggers early recompute. The current implementation (line 182-187) uses a simple threshold:
```typescript
const delta = entry.expiresAt - Date.now();
return delta < this.stampedeWindowMs;
```
This means ALL requests arriving within the stampede window trigger recompute. Without single-flight protection (see Issue 3), this guarantees a thundering herd.

**Files affected**:
- `src/managers/cache/adapters/memory.adapter.ts` (lines 182-187)

### Reproduction
```typescript
const cache = new MemoryCacheAdapter({ stampedeWindowMs: 5000 });
await cache.set('key', 'value', 6000); // expires in 6s, window in 5s
// At t=2s (within stampede window):
const factory = vi.fn().mockResolvedValue('fresh');
await cache.getOrSet('key', factory);
// factory IS called (early recompute) — correct behavior
// But if 100 concurrent calls arrive, factory runs 100 times — thundering herd
```

### Code Fix
Adopt probabilistic XFetch:
```typescript
private shouldEarlyRecompute(entry: CacheEntry<unknown>): boolean {
  if (this.stampedeWindowMs <= 0) return false;
  if (entry.expiresAt === undefined) return false;
  const delta = entry.expiresAt - Date.now();
  if (delta <= 0) return true;
  // XFetch probabilistic early recompute
  const beta = 1.0;
  const random = Math.random();
  return delta * beta * Math.log(random) < this.stampedeWindowMs;
}
```

### Prevention
- Document the XFetch algorithm choice (probabilistic vs deterministic)
- Add concurrency tests with 100+ concurrent `getOrSet` calls

---

## Issue 5: EventBus `request()` — Silent Hang with No Timeout

**Severity**: 🟠 HIGH
**Category**: Deadlock / Unbounded Wait

### Root Cause
`MemoryEventBusAdapter.request()` (lines 146-159) accepts a `timeoutMs` parameter but **never uses it** — the parameter is underscore-prefixed `_timeoutMs`. If no reply handler is registered, an error is thrown. But if a reply handler IS registered and never resolves (infinite loop, deadlock, network failure in a real adapter), `request()` hangs forever with no timeout.

**Files affected**:
- `src/managers/event-bus/adapters/memory.adapter.ts` (lines 146-159)

### Reproduction
```typescript
await adapter.reply('topic', async () => {
  return new Promise(() => {}); // never resolves
});
await adapter.request('topic', 'data', 1000);
// Hangs forever — timeout is ignored
```

### Code Fix
```typescript
async request<T, R>(topic: string, data: T, timeoutMs = 5000): Promise<R> {
  const handler = this.replyHandlers.get(topic);
  if (!handler) throw new EventBusConnectionError(`No reply handler for: ${topic}`);

  const result = await Promise.race([
    handler(data),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout: ${topic}`)), timeoutMs)
    ),
  ]);
  return result as R;
}
```

### Prevention
- Unit test: register a handler that never resolves, assert rejection after timeout
- All `request()` implementations must implement timeout via `Promise.race`

---

## Issue 6: DrizzleAdapter — Transaction Rollback Failure Masks Broken Connection

**Severity**: 🟡 MEDIUM
**Category**: Data Integrity / Silent Corruption

### Root Cause
In `DrizzleDatabaseAdapter.transaction()` (lines 134-155), if the `ROLLBACK` statement fails (e.g., connection lost mid-transaction), the error is silently swallowed:
```typescript
catch (error) {
  try { await this.execute('ROLLBACK'); }
  catch { /* Ignore rollback errors */ }  // line 146-148
  throw error; // throws the original fn() error, not the rollback failure
}
```
The caller never knows the transaction state is broken. The underlying connection may have an open, uncommitted transaction holding locks. This is especially dangerous for SQLite which uses file-level locking.

**Files affected**:
- `src/managers/database/adapters/drizzle.adapter.ts` (lines 134-155)

### Reproduction
Hard to reproduce deterministically without connection-killing middleware. The scenario: fn() throws an application error → ROLLBACK is attempted → network failure kills ROLLBACK → original error is thrown → connection has open transaction → next query blocks.

### Code Fix
Log the rollback failure and expose connection state:
```typescript
catch (error) {
  try {
    await this.execute('ROLLBACK');
  } catch (rollbackError) {
    // Connection is likely broken — mark as unhealthy
    this.initialized = false;
    throw new DatabaseTransactionError(
      'Transaction failed and rollback also failed — connection may be broken.',
      rollbackError instanceof Error ? rollbackError : undefined,
    );
  }
  throw error instanceof Error ? error : new DatabaseTransactionError('Transaction failed.');
}
```

### Prevention
- Integration test with a mock that simulates rollback failure
- Health check should verify transaction capability (BEGIN → ROLLBACK cycle)

---

## Issue 7: RedisCacheAdapter — Console Warning Flood on Redis Outage

**Severity**: 🟡 MEDIUM
**Category**: Observability / Resource Exhaustion

### Root Cause
Every failed cache operation logs via `console.warn()` unconditionally. If Redis is down and a hot code path calls `get()` / `set()` in a tight loop, stdout is flooded with warnings. On high-throughput systems, this can exhaust I/O buffers or disk space (if piped to a log file).

**Files affected**:
- `src/managers/cache/adapters/redis.adapter.ts` (lines 80, 98, 127, 137, 150)

### Reproduction
```typescript
// Redis down scenario
const adapter = new RedisCacheAdapter({ url: 'redis://down-host:6379' });
await adapter.start(); // fails silently, connected=false
for (let i = 0; i < 100000; i++) {
  await adapter.get(`key-${i}`); // console.warn EVERY iteration
}
```

### Code Fix
Rate-limit warnings and emit via observability instead of console:
```typescript
private lastWarnTime = 0;
private readonly WARN_THROTTLE_MS = 10000;

private warnOnce(id: string, key?: string): void {
  const now = Date.now();
  if (now - this.lastWarnTime > this.WARN_THROTTLE_MS) {
    this.lastWarnTime = now;
    // Use logger/observability, not console
    console.warn(`[redis-cache] ${id}${key ? ' ' + key : ''}`);
  }
}
```

### Prevention
- Use the LogManager port instead of raw `console.warn`
- Add throttle/debounce to repeated warning patterns
- Emit metric for cache operation failures (ObservabilityManager)

---

## Issue 8: StandardBootstrapAdapter — Double-Start Not Guarded

**Severity**: 🟡 MEDIUM
**Category**: Resource Leak / State Corruption

### Root Cause
`start()` resets `this.started = []` at the top but never checks `isStarted`. If called twice:
1. First call: starts all managers, sets `isStarted = true`
2. Second call: resets `started = []`, re-starts all managers (double-initialization)
3. Many adapters like `MemoryCacheAdapter.start()` create a fresh Map — **losing all cached data**

**Files affected**:
- `src/managers/bootstrap/adapters/standard.adapter.ts` (lines 62-90)

### Reproduction
```typescript
await bootstrap.start(); // starts managers, cache has data
await cache.set('key', 'value');
await bootstrap.start(); // re-initializes cache, 'key' lost, no error
```

### Code Fix
```typescript
async start(): Promise<void> {
  if (this.isStarted) {
    throw new BootstrapError('BootstrapOrchestrator is already started.');
  }
  // ... rest
}
```

### Prevention
- Add `isStarted` guard
- Unit test: `await bootstrap.start(); await bootstrap.start();` → expect rejection

---

## Issue 9: EventBus — Publish Iterates While Unsubscribe Can Modify Map

**Severity**: 🟡 MEDIUM
**Category**: Concurrent Modification / Data Race

### Root Cause
`publish()` iterates `subs.values()` while a subscriber handler could synchronously call `unsubscribe()` (which deletes from the same Map). While Node.js is single-threaded, if a handler DOES call `unsubscribe()` during publish:
```typescript
const handler = async (data, envelope) => {
  await adapter.unsubscribe(id); // modifies the Map being iterated
};
```
The iteration continues but the Map has been mutated. The `Map.forEach` / `Map.values()` iterator behavior in V8 after deletion during iteration is **unspecified** — some entries may be silently skipped.

**Files affected**:
- `src/managers/event-bus/adapters/memory.adapter.ts` (lines 88-108)

### Reproduction
```typescript
let subId: string;
subId = await adapter.subscribe('topic', async () => {
  await adapter.unsubscribe(subId); // self-unsubscribe during publish
});
await adapter.publish('topic', 'data');
// Subscriber may or may not receive the message — non-deterministic
```

### Code Fix
Snapshot the handler list before iteration:
```typescript
async publish<T>(topic: string, data: T): Promise<void> {
  const subs = this.subscribers.get(topic);
  if (!subs || subs.size === 0) return;

  const handlers = [...subs.values()]; // snapshot
  const envelope: EventEnvelope = { /* ... */ };

  const promises = handlers.map((handler) =>
    Promise.resolve(handler(data, envelope)).catch(() => {})
  );
  await Promise.all(promises);
}
```

### Prevention
- Always snapshot collections before iterating in async publish/subscribe code
- Unit test: handler that self-unsubscribes during publish

---

## Issue 10: FetchHttpClientAdapter — Local Error Class Shadows Shared Error

**Severity**: 🟢 LOW
**Category**: Type Safety / Error Classification

### Root Cause
`FetchHttpClientAdapter` defines a local `HttpClientError` class (lines 147-154) that shadows the shared `HttpClientError` from `shared/errors.ts`. The local class extends `Error` (not `CenfError`), meaning it's not caught by `isCenfError()` checks. The shared error hierarchy is bypassed.

**Files affected**:
- `src/managers/http-client/adapters/fetch.adapter.ts` (lines 147-154)

### Code Fix
Import and throw the shared `HttpClientError`:
```typescript
import { HttpClientError } from '../../../shared/errors.js';
// Replace local class with import
// Delete lines 147-154
```

### Prevention
- ESLint rule: ban `class XxxError extends Error` — all errors must extend `CenfError`
- Lint for shadowed imports from `shared/errors.js`

---

## Summary

| # | Issue | Severity | Category | Risk of Production Failure |
|---|-------|----------|----------|---------------------------|
| 1 | Bootstrap self-registration infinite recursion | 🔴 CRITICAL | Deadlock | Immediate if misconfigured |
| 2 | Redis error listener leak | 🟠 HIGH | Memory leak | Gradual OOM over days/weeks |
| 3 | Cache single-flight race | 🟠 HIGH | Race condition | Duplicate factory invocations |
| 4 | XFetch deterministic (not probabilistic) | 🟡 MEDIUM | Correctness | Stampede under load |
| 5 | EventBus request() no timeout | 🟠 HIGH | Deadlock | Request hangs forever |
| 6 | Drizzle rollback failure silent | 🟡 MEDIUM | Data integrity | Orphaned locks, blocked writers |
| 7 | Redis console.warn flood | 🟡 MEDIUM | Observability | Log spam under outage |
| 8 | Bootstrap double-start unguarded | 🟡 MEDIUM | Resource leak | Data loss on cache re-init |
| 9 | EventBus concurrent Map mutation | 🟡 MEDIUM | Data race | Lost messages |
| 10 | Local Error shadows CenfError | 🟢 LOW | Type safety | Misclassification in error handling |

**Overall assessment**: The codebase is well-structured with Clean Architecture patterns. The highest-risk issues are the bootstrap recursion (design flaw), the cache race conditions (concurrency bugs), and the event bus timeout omission (deadlock risk). All three can cause production outages. The memory leaks (Redis listener) and console flood will degrade over time under operational stress.
