# Code Audit: core-cenf-ts v0.1.0

**Auditor**: R2 Readability  
**Date**: 2026-06-25  
**Scope**: `src/shared/` and `src/managers/` (30 files read, all 19 managers surveyed)  
**Test coverage**: 708 tests, coverage thresholds at 80% statements / 75% branches / 80% lines  

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| WARNING  | 5 |
| SUGGESTION | 5 |

---

## CRITICAL

### 1. Plain `Error` thrown instead of `CenfError` subclass — breaks error taxonomy

**File**: `src/managers/database/adapters/drizzle.adapter.ts:227`  
**File**: `src/managers/database/adapters/memory.adapter.ts:208`  
**Evidence**:

```typescript
// drizzle.adapter.ts line 227 (inside getRepository)
if (result.rows.length === 0) {
  throw new Error(
    `Entity not found in table '${tableName}' with id '${id}'`,
  );
}

// memory.adapter.ts line 208 (identical pattern)
if (result.rows.length === 0) {
  throw new Error(
    `Entity not found in table '${tableName}' with id '${id}'`,
  );
}
```

**Why it matters**: The entire `CenfError` taxonomy (30+ error subclasses with unique codes, `isCenfError()` guard, `StandardErrorHandlingAdapter.classify()` lookup table) is bypassed. A plain `Error` has no `.code`, so it falls through to `DEFAULT_CLASSIFICATION` as `ERR_INTERNAL` / server-category / non-retryable. Callers can't programmatically distinguish a "not found" from other failures.

**Fix example**:
```typescript
// In database/errors.ts (new)
export class DatabaseEntityNotFoundError extends CenfError {
  readonly code = 'ERR_DATABASE_ENTITY_NOT_FOUND';
}

// In adapter
throw new DatabaseEntityNotFoundError(
  `Entity not found in table '${tableName}' with id '${id}'`,
);
```
And add `'ERR_DATABASE_ENTITY_NOT_FOUND'` to `CLASSIFICATION_MAP` in `standard.adapter.ts`.

---

### 2. `CLASSIFICATION_MAP` missing 5 error codes — silent misclassification

**File**: `src/managers/error-handling/adapters/standard.adapter.ts:30-81`  
**Evidence**: The following error codes defined in `src/shared/errors.ts` have **no entry** in `CLASSIFICATION_MAP`:

| Missing code | Class in `shared/errors.ts` | Default (wrong) |
|---|---|---|
| `ERR_STORAGE_PRESIGN` | `StoragePresignError` | server, not retryable |
| `ERR_FEATURE_FLAG` | `FeatureFlagError` | server, not retryable |
| `ERR_FEATURE_FLAG_NOT_FOUND` | `FeatureFlagNotFoundError` | server, not retryable |
| `ERR_RATE_LIMIT_EXCEEDED` | `RateLimitExceededError` | server, not retryable |
| `ERR_LOG_CONFIGURATION` | `LogConfigurationError` (managers/logging/errors.ts) | server, not retryable |

**Why it matters**: `RateLimitExceededError` is NOT a server error — it's a client-side rate-limiting response that should be classified as `'client'` with a user message. `FeatureFlagNotFoundError` is a client/config error. These misclassifications affect monitoring, retry logic, and API response shaping.

**Fix example**:
```typescript
ERR_RATE_LIMIT_EXCEEDED: {
  category: 'client',
  retryable: false,
  userMessage: 'Rate limit exceeded. Retry after the indicated window.',
},
ERR_FEATURE_FLAG_NOT_FOUND: {
  category: 'client',
  retryable: false,
},
ERR_FEATURE_FLAG:   { category: 'client', retryable: false },
ERR_STORAGE_PRESIGN: { category: 'server', retryable: false },
ERR_LOG_CONFIGURATION: { category: 'server', retryable: false },
```

---

## WARNING

### 3. `console.warn` bypasses LogManager port — breaks clean architecture

**File**: `src/managers/cache/adapters/redis.adapter.ts:80, 98, 127, 137, 150`  
**Evidence**: 5 occurrences of raw `console.warn` in error catch blocks:

```typescript
// Line 80
} catch {
  console.warn('[redis-cache] get failed', key);
  return null;
}
```

**Why it matters**: The `ILogManager` port exists precisely so all logging flows through a structured, injectable, testable channel. Direct `console.warn`:
- Can't be captured in tests
- Breaks structured logging (no JSON, no level filtering)
- Can't be redirected to files/streams
- Violates the Golden Rule ("Depend on Protocols, inject Adapters")

**Fix example**:
```typescript
// Accept an optional ILogManager in constructor options
private readonly logger: ILogManager;

constructor(options: RedisCacheOptions & { logger?: ILogManager } = {}) {
  this.logger = options.logger ?? new MemoryLogAdapter();
}

// In error handlers:
} catch (err) {
  this.logger.warn({ key, error: String(err) }, '[redis-cache] get failed');
  return null;
}
```

---

### 4. Silently swallowed errors break health reporting contract

**File**: `src/managers/s3.adapter.ts:110-123` (health)  
**File**: `src/managers/redis.adapter.ts:158-168` (start)  

**Evidence A** — S3 health check always returns healthy:
```typescript
async health(): Promise<HealthStatus> {
  try {
    await this.client.send(new HeadObjectCommand({ ... }));
    return { status: 'healthy', ... };
  } catch {
    // HeadObject may fail if the key doesn't exist — still healthy
    // if we can reach the bucket at all.
    return { status: 'healthy', ... };  // ← ALWAYS healthy
  }
}
```
If the S3 client has bad credentials, a network partition, or no IAM permissions, `HeadObject` throws — but `health()` still reports `'healthy'`. The comment assumes the only failure mode is "key not found", ignoring auth/network/access errors.

**Evidence B** — Redis start() silently degrades:
```typescript
async start(): Promise<void> {
  try {
    this.redis = new Redis(this.url);
    await this.redis.ping();
    this.connected = true;
  } catch {
    this.connected = false;  // ← no throw, caller thinks start() succeeded
  }
}
```
The caller has no way to know Redis is unavailable. The adapter enters a silent-degraded mode where all `get()/set()` calls return `null`/no-op.

**Fix example**:
```typescript
// S3 health
} catch (error) {
  const isNotFound = isNotFoundError(error);
  return {
    status: isNotFound ? 'healthy' : 'degraded',
    details: {
      adapter: 's3', bucket: this.bucket,
      error: isNotFound ? undefined : String(error),
    },
  };
}

// Redis start
async start(): Promise<void> {
  this.redis = new Redis(this.url);
  await this.redis.ping();
  this.connected = true;
  // Don't catch — let the error propagate so BootstrapOrchestrator can handle it
}
```
Or at minimum, throw `CacheConnectionError` on failure.

---

### 5. `env.adapter.ts` (config) loads ALL process.env into store — potential secret leak

**File**: `src/managers/config/adapters/env.adapter.ts:37-40`  
**Evidence**:

```typescript
async load<T>(schema: ZodSchema<T>): Promise<T> {
  try {
    const raw: Record<string, unknown> = { ...process.env };  // ← ALL env vars
    const parsed = schema.parse(raw);
    this.store = { ...raw };  // ← stores EVERYTHING
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      this.store[key] = value;
    }
    return parsed;
  }
}
```

**Why it matters**: `process.env` contains sensitive values (API keys, database URLs, secrets) that are NOT part of the config schema. These get persisted in `this.store` and become accessible via `config.get('DATABASE_URL')` even if the schema didn't request that key. A downstream consumer calling `.get()` with any env var name can extract secrets from the config manager that should only be accessible via `SecretManager`.

**Fix example**: Only store schema-validated keys:
```typescript
async load<T>(schema: ZodSchema<T>): Promise<T> {
  const raw: Record<string, unknown> = { ...process.env };
  const parsed = schema.parse(raw);
  this.store = { ...(parsed as Record<string, unknown>) };  // ← only parsed keys
  return parsed;
}
```

---

### 6. `drizzle.adapter.ts` transaction COMMIT failure leaves undefined state

**File**: `src/managers/database/adapters/drizzle.adapter.ts:134-156`  
**Evidence**:

```typescript
async transaction<T>(fn: (db: DatabaseManager) => Promise<T>): Promise<T> {
  this.ensureInitialized();
  try {
    await this.execute('BEGIN');
    const result = await fn(this);
    await this.execute('COMMIT');  // ← if this throws, what happens?
    return result;
  } catch (error) {
    try {
      await this.execute('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw error instanceof Error ? error : new DatabaseTransactionError(...);
  }
}
```

**Why it matters**: If `fn()` succeeds but `this.execute('COMMIT')` fails due to a network blip or connection drop, the code falls into the `catch` block and tries `ROLLBACK`. But the connection may already be dead — the ROLLBACK also fails (silently). The transaction's actual state in the database is unknown (it might have committed, might be in-doubt). The caller gets an error but doesn't know whether the data was actually persisted.

**Fix example**: At minimum, distinguish the rollback error:
```typescript
} catch (error) {
  try {
    await this.execute('ROLLBACK');
  } catch (rollbackErr) {
    throw new DatabaseTransactionError(
      `Transaction commit/rollback failed. DB state unknown. Original: ${error}. Rollback: ${rollbackErr}`,
    );
  }
  throw error instanceof Error ? error : new DatabaseTransactionError(...);
}
```
Or use the underlying driver's native transaction API (libsql client supports transactions natively).

---

### 7. `redis.adapter.ts` reconnection state is stale

**File**: `src/managers/cache/adapters/redis.adapter.ts:159-163`  
**Evidence**:

```typescript
async start(): Promise<void> {
  try {
    this.redis = new Redis(this.url);
    this.redis.on('error', () => {
      this.connected = false;  // ← set to false on error
    });
    await this.redis.ping();
    this.connected = true;
  } catch {
    this.connected = false;
  }
}
```

**Why it matters**: ioredis has built-in auto-reconnect. When it reconnects successfully, `this.connected` remains `false` because there's no `'ready'` or `'connect'` handler to set it back to `true`. The `health()` method reports `'degraded'` forever even after Redis comes back.

**Fix example**:
```typescript
this.redis.on('error', () => { this.connected = false; });
this.redis.on('ready', () => { this.connected = true; });
this.redis.on('connect', () => { this.connected = true; });
```

---

## SUGGESTION

### 8. `types.ts` — fragile dual-export pattern for TDD

**File**: `src/shared/types.ts:91-104`  
**Evidence**:

```typescript
declare const TYPE_BRAND: unique symbol;
export type JsonValueBrand = { readonly [TYPE_BRAND]: 'core-cenf-ts/types' };
export const JsonValue = null as unknown as JsonValueBrand;
```

The `JsonValue` export is a type at compile time and `null` at runtime. The sole purpose is to force module resolution for barrel-export tests. This `null as unknown as` chain is brittle — it survives only because no runtime code actually uses the value. A `Symbol('json-value-brand')` would be safer and more explicit.

---

### 9. `pino.adapter.ts` — `Object.create` for child loggers

**File**: `src/managers/logging/adapters/pino.adapter.ts:56-60`  
**Evidence**:

```typescript
private static fromLogger(logger: Logger): PinoLogAdapter {
  const adapter = Object.create(PinoLogAdapter.prototype) as PinoLogAdapter;
  adapter.logger = logger;
  return adapter;
}
```

`Object.create()` bypasses the constructor entirely. Refactoring the constructor (adding new properties, validation, or side effects) will silently break child logger instances. A private constructor or explicit `setLogger()` method would be more maintainable.

---

### 10. `drizzle.adapter.ts` — unnecessary `eslint-disable` with arrow functions

**File**: `src/managers/database/adapters/drizzle.adapter.ts:174`  
**Evidence**:

```typescript
getRepository<T>(tableName: string): GenericRepository<T> {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;

  return {
    async findById(id: string | number): Promise<T | null> {
      const result = await self.query<T>(...);  // ← uses self
    },
  };
}
```

The returned object uses method shorthand syntax (not arrow functions), so `self` is needed. But converting to arrow functions would capture `this` naturally and eliminate the ESLint suppression:

```typescript
return {
  findById: async (id: string | number): Promise<T | null> => {
    const result = await this.query<T>(...);  // ← arrow captures outer this
  },
};
```

---

### 11. `context.ts` — plain Error instead of CenfError

**File**: `src/shared/context.ts:59`  
**Evidence**:

```typescript
export function setContext(update: Partial<ContextStore>): void {
  const current = contextStore.getStore();
  if (current === undefined) {
    throw new Error('No active context. Call runInContext() first.');
  }
  Object.assign(current, update);
}
```

This is a programming error (using `setContext` without `runInContext`), so a plain Error is defensible. However, consistency with the rest of the codebase suggests using a CenfError subclass. Currently it can't be caught by `isCenfError()` or classified by `StandardErrorHandlingAdapter`.

---

### 12. Duplicated "no-op" lifecycle methods across adapters

**Files**: `memory.adapter.ts` (config), `env.adapter.ts` (secret), `memory.adapter.ts` (cache), `zod.adapter.ts`, `standard.adapter.ts`, `noop.adapter.ts` (observability), and 4+ others.

All share identical:
```typescript
async start(): Promise<void> { /* no-op */ }
async stop(): Promise<void> { /* no-op */ }
```

This is inherent to the `AsyncLifecycle` contract for pure-logic adapters. Not a bug, but ~10 copies of the same 2-line no-op. A future refactor could provide an `AbstractNoopLifecycle` base class if this class grows.

---

## What Is Good

- **Clean Architecture compliance**: All 19 managers follow Ports & Adapters. The index.ts barrel file correctly depends on ports, not adapter internals. The Golden Rule is consistently applied.
- **Error taxonomy**: 30+ error subclasses with unique codes, programmatic classification via `isCenfError()`, and a centralized `CLASSIFICATION_MAP`. The architecture is solid — just needs the missing codes added (CRITICAL #2).
- **Test coverage**: 708 tests with 80% thresholds. Error hierarchy, lifecycle, retry, backoff, hashing, all manager ports have dedicated test suites.
- **Zero secrets in source**: No `.env` files, no hardcoded API keys, no exposed tokens. `SecretManager` correctly uses env vars with in-memory override pattern.
- **Input validation**: `ValidationManager` wraps Zod's `safeParse` returning `Result<T, ValidationError[]>` instead of throwing — a proper functional boundary.
- **Cache stampede protection**: `redis.adapter.ts` implements single-flight `getOrSet` via `pendingGets` Map, preventing thundering herd.
- **Documentation**: JSDoc on every exported interface, method, and parameter. Module-level `@module` tags. Public API surface is well-documented.
- **Node.js native APIs**: Uses `process.loadEnvFile()` (Node >=21.7), `AsyncLocalStorage`, `node:crypto` — zero unnecessary polyfills.
- **Graceful degradation**: Redis and S3 adapters handle connection failures without crashing the process. (Needs improvement on error reporting — see WARNING #4.)
