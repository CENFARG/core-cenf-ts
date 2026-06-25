# RedisCacheAdapter Specification

## Purpose

Production Redis cache adapter using ioredis, providing key-value caching with TTL, XFetch stampede protection, key prefix scoping, and graceful in-memory fallback on Redis errors.

## Port Interface

```typescript
interface ICacheManager {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  health(): Promise<CacheHealth>;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `RedisCacheAdapter` | ioredis-based production adapter with XFetch, prefix scoping, fallback |
| `MemoryCacheAdapter` | In-memory Map with TTL eviction (fallback) |

## Error Types

- `CacheConnectionError` — Redis unreachable, connection refused
- `CacheOperationError` — GET/SET/DEL operation failure

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_CACHE_URL` | `string` | `redis://localhost:6379` | Redis connection URL |
| `CENF_CACHE_KEY_PREFIX` | `string` | `core-cenf:cache` | Key prefix for scoping |
| `CENF_CACHE_DEFAULT_TTL` | `number` | `300` | Default TTL in seconds |
| `CENF_CACHE_STAMPEDE_WINDOW` | `number` | `10` | XFetch early recompute window (seconds) |

## Requirements

### Requirement: Redis Connection Lifecycle

The system MUST connect to Redis via ioredis using the configured `CENF_CACHE_URL`. On connection failure, it MUST fall back to the in-memory adapter. The adapter MUST prefix all keys with `core-cenf:cache:{key}` by default.

#### Scenario: Successful Redis connection

- GIVEN `CENF_CACHE_URL=redis://localhost:6379` and Redis is running
- WHEN `await adapter.start()` is called
- THEN the ioredis client connects successfully
- AND `await adapter.health()` returns `{ connected: true }`

#### Scenario: Connection failure triggers memory fallback

- GIVEN `CENF_CACHE_URL=redis://unreachable:6379` and Redis is down
- WHEN `await adapter.start()` is called
- THEN it catches the connection error
- AND switches to `MemoryCacheAdapter` internally
- AND subsequent `get()`/`set()` operations use memory

#### Scenario: Key prefix scoping

- GIVEN adapter is configured with `keyPrefix: "myapp"`
- WHEN `await adapter.set("user:1", { name: "Alice" })` is called
- THEN the actual Redis key stored is `myapp:user:1`
- AND `await adapter.get("user:1")` retrieves the value

### Requirement: TTL-Aware Redis Operations

The system MUST store values in Redis with configurable TTL. Expired keys MUST return `undefined`. Serialization MUST handle objects, arrays, and primitives.

#### Scenario: Set and get with TTL

- GIVEN Redis is connected
- WHEN `await adapter.set("key1", { data: "value" }, 60)` is called
- THEN `await adapter.get("key1")` returns `{ data: "value" }`
- AND Redis TTL is set to 60 seconds

#### Scenario: Expired key returns undefined

- GIVEN a key was set with `ttl: 1` second
- WHEN 2 seconds pass and `await adapter.get(key)` is called
- THEN it returns `undefined`
- AND no error is thrown

#### Scenario: Default TTL applied when not specified

- GIVEN `CENF_CACHE_DEFAULT_TTL=300`
- WHEN `await adapter.set("key", "value")` is called without TTL
- THEN Redis stores the key with 300-second TTL

### Requirement: XFetch Stampede Protection

The system MUST implement single-flight deduplication: when multiple concurrent callers request the same cache-miss key, only ONE factory execution occurs. Others await the result.

#### Scenario: Single-flight on concurrent cache miss

- GIVEN key "expensive" is not in cache
- WHEN 10 concurrent callers invoke `getOrSet("expensive", factory)` simultaneously
- THEN `factory` is called exactly once
- AND all 10 callers receive the same result
- AND the result is stored in cache

#### Scenario: Normal operation when key exists

- GIVEN key "cached" exists in Redis with 50s remaining TTL
- WHEN `getOrSet("cached", factory, 60)` is called
- THEN the cached value is returned immediately
- AND `factory` is NOT called

### Requirement: Graceful Error Recovery

The system MUST catch Redis errors during any operation and fall back to the in-memory adapter for that operation. The adapter MUST NOT throw on transient Redis failures.

#### Scenario: Redis timeout during get()

- GIVEN Redis is connected but becomes unresponsive
- WHEN `await adapter.get("key")` times out
- THEN the error is caught
- AND the memory adapter is consulted as fallback
- AND no exception propagates to the caller

#### Scenario: Redis reconnection after failure

- GIVEN Redis was unreachable and fallback is active
- WHEN Redis becomes available again
- THEN the adapter attempts reconnection on next operation
- AND switches back to Redis on success

### Requirement: Health Check with Latency

The system MUST report Redis connectivity status, round-trip latency, and key count (when available).

#### Scenario: Health check returns Redis metrics

- GIVEN Redis is connected and healthy
- WHEN `await adapter.health()` is called
- THEN it returns `{ connected: true, latencyMs: <50, keysCount: N }`
- AND latency is measured via Redis PING
