# CacheManager Specification

## Purpose

Provides key-value caching with TTL support and cache stampede protection (XFetch algorithm). Supports Redis for production and in-memory fallback.

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

interface CacheHealth {
  connected: boolean;
  latencyMs: number;
  keysCount?: number;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `RedisCacheAdapter` | Wraps `ioredis` with serialization and XFetch |
| `MemoryCacheAdapter` | In-memory Map with TTL eviction |

## Error Types

- `CacheConnectionError` — Redis unreachable, connection refused
- `CacheOperationError` — GET/SET/DEL operation failure

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_CACHE_URL` | `string` | `redis://localhost:6379` | Redis connection string |
| `CENF_CACHE_DEFAULT_TTL` | `number` | `300` | Default TTL in seconds |
| `CENF_CACHE_STAMPEDE_WINDOW` | `number` | `10` | XFetch early recompute window (seconds) |

## Lifecycle

- `start()`: Connects to Redis, runs PING health check
- `stop()`: Closes Redis connection, clears memory cache
- `health()`: Returns connection status, latency, key count

## Testing Strategy

- **Unit**: `MemoryCacheAdapter` — TTL expiry, XFetch stampede prevention
- **Integration**: `RedisCacheAdapter` with testcontainers or mock Redis
- **Edge cases**: Connection loss recovery, serialization of complex types, large values

## Requirements

### Requirement: TTL-Aware Key-Value Operations

The system MUST store and retrieve values with optional TTL. Expired entries MUST return `undefined` on get, NOT the stale value.

#### Scenario: Set and get with TTL

- GIVEN cache is connected
- WHEN `await cache.set("key1", { data: "value" }, 60)` is called
- THEN `await cache.get("key1")` returns `{ data: "value" }`
- AND the value expires after 60 seconds

#### Scenario: Expired key returns undefined

- GIVEN a key was set with `ttl: 1` second
- WHEN 2 seconds pass and `await cache.get(key)` is called
- THEN it returns `undefined`
- AND no error is thrown

#### Scenario: Delete is idempotent

- GIVEN a key that does not exist in cache
- WHEN `await cache.del("nonexistent")` is called
- THEN it returns `false` (or true, implementation-defined)
- AND no error is thrown

### Requirement: XFetch Stampede Mitigation

The system MUST implement XFetch probabilistic early recompute to prevent thundering herd when hot keys near expiry.

#### Scenario: Early recompute near expiry

- GIVEN a key with TTL=60s that was set 55 seconds ago (5s remaining)
- WHEN `getOrSet(key, factory, 60)` is called and stampede window is 10s
- THEN it probabilistically triggers early recompute
- AND the factory is called to refresh the value before full expiry

#### Scenario: Normal get when not near expiry

- GIVEN a key with TTL=60s that was set 10 seconds ago (50s remaining)
- WHEN `getOrSet(key, factory, 60)` is called
- THEN the cached value is returned
- AND the factory is NOT called

#### Scenario: Cache miss triggers factory

- GIVEN a key that does not exist in cache
- WHEN `getOrSet(key, factory, 60)` is called
- THEN the factory is invoked
- AND the result is stored in cache with TTL=60
- AND the result is returned to the caller
