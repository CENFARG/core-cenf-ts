# Error Detective — core-cenf-ts v0.2.0

**Audit date**: 2026-06-25  
**Scope**: `src/shared/errors.ts`, all 19 managers (ports + adapters), `error-handling` manager, `src/shared/utils.ts`, `src/shared/context.ts`  
**Rule sources**: ai-course-2 slides 09, 13, 14, 15, 16, 17, 29

---

## 1. Error Class Hierarchy

### BLOCKER: Duplicate `HttpClientError` class shadows shared CenfError subtype

- **File:line**: `src/managers/http-client/adapters/fetch.adapter.ts:147-153`
- **Evidence**: A local `class HttpClientError extends Error` (NOT `CenfError`) is defined inside the adapter file. The shared `errors.ts` already exports `HttpClientError extends CenfError` at line 170.
- **Root cause hypothesis**: The adapter was written independently and the author used a local convenience class instead of importing the shared one. This may have been an oversight during PR review.
- **Impact**: `isCenfError()` returns `false` for errors thrown by `FetchHttpClientAdapter.lookup()`. The `CLASSIFICATION_MAP` in `standard.adapter.ts` maps `ERR_HTTP_CLIENT` → `network`/retryable, but this mapping is never reached. The error falls through to `DEFAULT_CLASSIFICATION` (`server`/non-retryable). **Observability hooks, error-rate dashboards, and retry logic will misclassify this error.**
- **Fix**: Replace the local class with an import of `HttpClientError` from `../../../shared/errors.js`. Delete lines 142-153.

### BLOCKER: Raw `new Error()` in production code breaks CenfError taxonomy contract

| File:line | Context | Impact |
|---|---|---|
| `src/managers/database/adapters/drizzle.adapter.ts:227` | `getRepository().update()` entity-not-found | No `code`, unclassifiable by `StandardErrorHandlingAdapter` |
| `src/managers/database/adapters/memory.adapter.ts:208` | `getRepository().update()` entity-not-found | Same — raw Error, same path |
| `src/shared/context.ts:59` | `setContext()` called outside scope | No `code`, `isCenfError` returns false |

- **Root cause hypothesis**: These codepaths were written before the error taxonomy was fully established, or the author considered them "internal" errors that didn't need classification. But `getRepository()` is a public API, and context errors need to be distinguishable from other internal failures.
- **Fix**: Use `DatabaseQueryError` for entity-not-found cases. Create a `ContextError` (or use `ConfigError` with `ERR_CONTEXT`) for the `setContext` guard. All three need stable codes for classification.

### SUMMARY: Hierarchy is well-designed but inconsistently applied

- ✅ Abstract base class `CenfError` with runtime guard against direct instantiation
- ✅ Stable `code` string per subtype — programmatic classification
- ✅ `cause: unknown` parameter preserves error chains
- ✅ 29 concrete subtypes covering all manager domains
- ✅ Manager-specific error files extend the hierarchy (`ConfigValidationError`, `SecretNotFoundError`, `LogConfigurationError`)
- ⚠️ Subtypes are minimal (only `code` field) — no HTTP status codes, retry hints, or structured metadata
- ❌ The raw `new Error()` and local `HttpClientError` class violate the "every error extends CenfError" contract

---

## 2. Error Messages — Actionability

### CRITICAL: BootstrapError loses the original error cause

- **File:line**: `src/managers/bootstrap/adapters/standard.adapter.ts:83-85`
- **Evidence**:
  ```typescript
  throw new BootstrapError(
    `Failed to start manager '${entry.name}': ${error instanceof Error ? error.message : String(error)}`,
  );
  ```
  The original `error` is stringified into the message but NOT passed as `cause` (second constructor parameter).
- **Root cause hypothesis**: The `BootstrapError` constructor signature `(message: string, cause?: unknown)` supports chaining, but the call site omits the second argument. Likely an oversight.
- **Impact**: When the orchestrator fails during startup, the root cause (e.g., a `DatabaseConnectionError`) is lost. The only diagnostic is the stringified message. Stack trace chains are broken. **Recovery path: no way to programmatically determine WHICH subsystem failed and WHY.**
- **Fix**: Add `error` as the second argument: `new BootstrapError(msg, error)`.

### CRITICAL: S3 `health()` returns `healthy` even when S3 is unreachable

- **File:line**: `src/managers/storage/adapters/s3.adapter.ts:118-121`
- **Evidence**:
  ```typescript
  } catch {
    return { status: 'healthy', details: { adapter: 's3', bucket: this.bucket } };
  }
  ```
  ALL errors (network timeout, AccessDenied, DNS failure) are caught and reported as `healthy`.
- **Root cause hypothesis**: The comment at line 119 says "HeadObject may fail if the key doesn't exist — still healthy" but the catch is too broad. A non-existent key returns `NoSuchKey` from S3, but a network error or credential failure should surface as `degraded` or `unhealthy`.
- **Impact**: **K8s readiness probes will pass on a broken S3 connection.** The health endpoint is the single source of truth for orchestration — when it lies, auto-scaling and failover decisions are wrong.
- **Fix**: Distinguish `NoSuchKey`/`NotFound` (healthy) from other errors (degraded/unhealthy). Use the existing `isNotFoundError()` helper already defined in the same file (line 42).

### WARNING: Several error messages leak implementation details

- **`DatabaseConnectionError`** (`drizzle.adapter.ts:61`): `Failed to connect to database at '${this.config.url}'` — the URL may contain credentials (e.g., `postgres://user:pass@host/db`). The `handle()` method in `StandardErrorHandlingAdapter` sanitizes messages for `server` category errors but the raw error message already exists in logs.
- **`ConfigValidationError`** (`env.adapter.ts:48`): `Config validation failed: ${(error as Error).message}` — uses unsafe `as Error` cast. If `error` is not an Error (e.g., thrown string), the cast produces `undefined.message` → TypeScript doesn't catch this at runtime.
- **`JoseJwtAdapter`** (`jose.adapter.ts:119`): `Failed to sign JWT: ${(error as Error).message}` — same unsafe cast pattern.

---

## 3. Error Propagation — Wrap/Rethrow

### BLOCKER: S3 `list()` has no error handling — raw AWS SDK errors leak

- **File:line**: `src/managers/storage/adapters/s3.adapter.ts:217-222`
- **Evidence**: `ListObjectsV2Command` is sent without a try/catch. Any error (network, permission, throttling) propagates as a raw `@aws-sdk/client-s3` error — not a CenfError.
- **Root cause hypothesis**: The `list()` method was overlooked during the error-wrapping pass that covered `put()`, `get()`, `delete()`, and `exists()`.
- **Impact**: Upstream callers expecting CenfError classification will receive an untyped AWS error. `isCenfError()` → false. `classify()` → `DEFAULT_CLASSIFICATION`. No retryability hint. **Observability: error-rate metrics can't distinguish "S3 list failed" from "unknown server error".**
- **Fix**: Wrap in a try/catch, throw `StorageDownloadError` (or `StorageListError` if a new subtype is preferred — `ERR_STORAGE_LIST` is missing from the taxonomy).

### BLOCKER: S3 `getPresignedUrl()` has no error handling

- **File:line**: `src/managers/storage/adapters/s3.adapter.ts:276-282`
- **Evidence**: `getSignedUrl()` call is not wrapped. `StoragePresignError` exists in `errors.ts` (line 156, code `ERR_STORAGE_PRESIGN`) but is never imported or used in the S3 adapter.
- **Root cause hypothesis**: The method is marked "stub, expanded in TASK_015 GREEN" (line 269) — it was meant to be completed later but was left without error handling.
- **Impact**: Presigned URL generation failure propagates as a raw AWS SDK error. The `ERR_STORAGE_PRESIGN` error type exists but is dead code.
- **Fix**: Wrap in try/catch, throw `StoragePresignError`, import it from shared errors.

### ✅ GOOD: Well-wrapped patterns

- `S3StorageAdapter.put()/get()/delete()/exists()` — properly wraps AWS errors in Storage*Error subtypes, passes `cause`
- `DrizzleDatabaseAdapter.query()/execute()` — wraps libsql errors in `DatabaseQueryError`
- `JoseJwtAdapter.verify()` — maps 4 distinct jose error types to the correct CenfError subtypes
- `EnvConfigAdapter.load()/MemoryConfigAdapter.load()` — wraps Zod parse errors in `ConfigValidationError`
- `SecretAdapter.get()` — throws `SecretNotFoundError` with the secret name in the message

### WARNING: Drizzle transaction re-throws raw errors without type

- **File:line**: `src/managers/database/adapters/drizzle.adapter.ts:149-155`
- **Evidence**:
  ```typescript
  throw error instanceof Error
    ? error
    : new DatabaseTransactionError('Transaction failed.', ...);
  ```
  If `error` is a `CenfError` (e.g., `DatabaseQueryError` from within the transaction), it passes through unchanged. The caller sees a `DatabaseQueryError` for a transaction failure — the error type is misleading. The transaction context is lost.
- **Fix**: Always wrap in `DatabaseTransactionError` with the original error as `cause`.

---

## 4. Error Recovery — Silent Swallows

### BLOCKER: RedisCacheAdapter silently swallows ALL operation errors

- **Files:lines**:
  - `src/managers/cache/adapters/redis.adapter.ts:79-82` (`get()`)
  - `src/managers/cache/adapters/redis.adapter.ts:97-99` (`set()`)
  - `src/managers/cache/adapters/redis.adapter.ts:126-128` (`del()`)
  - `src/managers/cache/adapters/redis.adapter.ts:136-138` (`has()`)
  - `src/managers/cache/adapters/redis.adapter.ts:149-152` (`clear()`)
- **Evidence**: Every Redis operation wraps the call in `try { ... } catch { console.warn(...); return null/false; }`. The `start()` method also swallows connection failures (lines 166-168).
- **Root cause hypothesis**: This was an intentional "graceful degradation" design — if Redis is down, act as a cache-miss. The `AGENTS.md` states "Falls back to in-memory operation when Redis is unavailable." But the fallback is a silent no-op, not a switch to MemoryCacheAdapter.
- **Impact**: **`set()` failures lose data silently.** `get()` failures are indistinguishable from cache-miss. `has()` returns `false` when Redis is down — callers will think keys don't exist. `clear()` fails silently — stale data persists. **Production error rate: these failures are invisible to any observability system.** The only signal is a `console.warn` that may not be captured in production logs.
- **Fix**: Three options, in order of preference:
  1. Throw `CacheOperationError`/`CacheConnectionError` (CenfError subtypes already exist). Let callers decide whether to fall back.
  2. Emit structured observability events (metrics counter + span event) before returning null/false.
  3. Auto-switch to an in-memory MemoryCacheAdapter on connection failure (the documented behavior).

### CRITICAL: Silent `.env` load failures in EnvConfigAdapter

- **Files:lines**:
  - `src/managers/config/adapters/env.adapter.ts:71-73` (`reload()`)
  - `src/managers/config/adapters/env.adapter.ts:96-98` (`start()`)
- **Evidence**: `process.loadEnvFile()` failures are caught silently. The comment says "File doesn't exist — continue with existing process.env values", but the catch block also swallows permission errors, parse errors, and any other failure.
- **Impact**: If `.env` exists but is malformed or unreadable, the adapter starts without loading it and without signaling the problem. Configuration may be silently incomplete.
- **Fix**: Distinguish ENOENT (file not found — acceptable) from other errors (throw `ConfigValidationError`).

### WARNING: MemoryAuthAdapter.verify() accepts invalid signatures

- **File:line**: `src/managers/auth/adapters/memory.adapter.ts:91-94`
- **Evidence**: When the re-signed token doesn't match the provided token, the comment says "Return payload anyway (memory adapter is lenient for testing)". No error is thrown.
- **Root cause hypothesis**: Intentional design for testing convenience. The memory adapter is documented as "no real cryptography."
- **Impact**: Tests that expect signature verification to fail will get false positives. But this is a test-only adapter, not used in production. **However**, if someone mistakenly uses `MemoryAuthAdapter` in a production-like environment, invalid tokens pass verification.
- **Verdict**: WARNING, not BLOCKER — test-only adapter. But add a prominent JSDoc comment and consider an `assertProduction()` guard.

### ✅ ACCEPTABLE: Documented silent swallows

| Location | Pattern | Why acceptable |
|---|---|---|
| `BootstrapOrchestrator.start():78-79` | Rollback errors swallowed | Commented: "original failure is more important" |
| `BootstrapOrchestrator.stop():101-104` | Shutdown errors collected | Commented: "nothing to do about individual failures at shutdown" |
| `EventBusAdapter.publish():102-104` | Subscriber errors swallowed | Documented: "Fire-and-forget: subscriber errors do not propagate to publisher" |
| `DrizzleDatabaseAdapter.transaction():146` | ROLLBACK errors swallowed | Commented: "Ignore rollback errors" |

---

## 5. Missing Error Types

### BLOCKER: 5 error codes not in CLASSIFICATION_MAP

- **File:line**: `src/managers/error-handling/adapters/standard.adapter.ts:30-81`
- **Evidence**: The following error codes exist in `shared/errors.ts` and are exported from `index.ts`, but have NO entry in `CLASSIFICATION_MAP`:

| Error Code | Error Class | Defined at | Missing from map |
|---|---|---|---|
| `ERR_STORAGE_PRESIGN` | `StoragePresignError` | `errors.ts:157` | ✗ |
| `ERR_FEATURE_FLAG` | `FeatureFlagError` | `errors.ts:100` | ✗ |
| `ERR_FEATURE_FLAG_NOT_FOUND` | `FeatureFlagNotFoundError` | `errors.ts:105` | ✗ |
| `ERR_RATE_LIMIT_EXCEEDED` | `RateLimitExceededError` | `errors.ts:114` | ✗ |
| `ERR_LOG_CONFIGURATION` | `LogConfigurationError` | `logging/errors.ts:18` | ✗ |

- **Root cause hypothesis**: These errors were added in later PRs (PR #4 — feature flags, rate limiter; PR #6 — logging) but the `CLASSIFICATION_MAP` was not kept in sync. The `StoragePresignError` was added but never wired.
- **Impact**: When any of these errors are thrown, `classify()` falls through to `DEFAULT_CLASSIFICATION` → `server`/non-retryable. For `RateLimitExceededError`, this is WRONG — rate limit exceeded should be `client`/non-retryable (the caller should back off, not retry). For `FeatureFlagError`/`FeatureFlagNotFoundError`, these should be `client` errors (configuration problem). **Without correct classification, retry logic, alerting, and error-rate dashboards produce incorrect results.**
- **Fix**: Add entries to `CLASSIFICATION_MAP`:
  - `ERR_RATE_LIMIT_EXCEEDED` → `{ category: 'client', retryable: false, userMessage: 'Rate limit exceeded' }`
  - `ERR_FEATURE_FLAG` / `ERR_FEATURE_FLAG_NOT_FOUND` → `{ category: 'client', retryable: false }`
  - `ERR_STORAGE_PRESIGN` → `{ category: 'server', retryable: false }`
  - `ERR_LOG_CONFIGURATION` → `{ category: 'server', retryable: false }`

### WARNING: Dead error types — defined but never used

| Error Class | File | Status |
|---|---|---|
| `ConfigNotFoundError` | `config/errors.ts:34` | Defined and exported, but never thrown in env.adapter or memory.adapter. `get()` returns `undefined` instead. |
| `LogConfigurationError` | `logging/errors.ts:17` | Defined and exported, but never thrown in pino.adapter or memory.adapter. |
| `FeatureFlagError` | `errors.ts:99` | Exported from index.ts but `MemoryFeatureFlagAdapter` returns boolean defaults, never throws. |
| `FeatureFlagNotFoundError` | `errors.ts:104` | Same — never thrown. |
| `RateLimitExceededError` | `errors.ts:113` | Exported but `MemoryRateLimiterAdapter.consume()` returns `{ allowed: false, retryAfterMs }` instead of throwing. This is actually a valid Rust-style Result pattern — but the error type exists and is unused. |

---

## 6. `@handle_errors` / `wrap()` Pattern

### BLOCKER: `IErrorHandlingManager.wrap()` exists but is NEVER adopted by any adapter

- **File:line**: `src/managers/error-handling/adapters/standard.adapter.ts:174-207`
- **Evidence**: The `wrap()` method is implemented and tested (8 test cases in `standard.adapter.test.ts`), but **no manager adapter calls it**. Every adapter implements its own error handling with manual try/catch blocks. The `wrap()` method correctly handles both sync and async functions, preserves `this` context, and enriches errors with source/operation context — but it's dead code in production paths.
- **Root cause hypothesis**: The `ErrorHandlingManager` was designed as infrastructure, but managers were implemented independently without a dependency injection pattern that would inject the error handler. Managers don't receive an `IErrorHandlingManager` in their constructors.
- **Impact**: 
  1. **Inconsistent error enrichment**: Some adapters pass `cause`, some don't. Some add context, some don't. 
  2. **No centralized error-rate observability**: Without `wrap()`, there is no single hook to increment error counters, record spans, or emit metrics on failure.
  3. **Duplicated error-handling code**: Every adapter has its own try/catch patterns. Changes to error handling require editing 20+ files.
- **Fix**: Inject `IErrorHandlingManager` into adapters that need it (especially network-facing ones: Redis, S3, Drizzle, HTTP client). Use `wrap()` to decorate public methods. This is a significant architectural change — consider it for v0.3.0.

---

## 7. Stack Trace Preservation

### CRITICAL: BootstrapError loses the original error cause (stack chain broken)

- **File:line**: `src/managers/bootstrap/adapters/standard.adapter.ts:83-85`
- **Evidence**: Same issue as in §2. The `cause` parameter is omitted. When multiple managers fail during start, the orchestrator loses the causal chain.
- **Impact**: During startup failure forensics, the stack trace shows `BootstrapError` at the top but the actual root cause (e.g., `DatabaseConnectionError` from `DrizzleDatabaseAdapter.start()`) is not in the `.cause` chain. **`error.cause` is `undefined`**. This breaks standard Node.js error inspection tools (`console.error`, `pino` structured logging of error stacks, Sentry error grouping).
- **Fix**: Pass the original error as second argument to `BootstrapError` constructor.

### ✅ GOOD: Stack traces preserved where cause is properly passed

Verified by `errors.test.ts:105-112` — all 29 error subtypes preserve stack traces.  
Verified by `errors.test.ts:114-118` — `cause` is accessible when provided.  
Verified in adapters: `S3StorageAdapter`, `DrizzleDatabaseAdapter`, `JoseJwtAdapter` all pass the original error as `cause`.

---

## Summary — Severity Count

| Severity | Count | Key theme |
|---|---|---|
| **BLOCKER** | 8 | Taxonomy violations, missing classification entries, silent data loss |
| **CRITICAL** | 5 | Lost error chains, silent health checks, unused infrastructure |
| **WARNING** | 6 | Dead error types, unsafe casts, missing wrapping |
| **SUGGESTION** | 0 | — |

### BLOCKER items (must fix before production release)

1. **Duplicate `HttpClientError`** — `fetch.adapter.ts:147` shadows shared CenfError subtype
2. **Raw `new Error()`** — 3 occurrences in production code (`drizzle.adapter.ts:227`, `memory.adapter.ts:208`, `context.ts:59`)
3. **S3 `list()` no error handling** — `s3.adapter.ts:217` raw AWS errors leak
4. **S3 `getPresignedUrl()` no error handling** — `s3.adapter.ts:276` dead `StoragePresignError`
5. **Redis silent error swallowing** — 5 methods + `start()` lose data and observability
6. **Missing `CLASSIFICATION_MAP` entries** — 5 error codes unclassified, `RateLimitExceededError` misclassified as `server`
7. **`wrap()` never adopted** — error handling infrastructure is dead code in production paths
8. **BootstrapError loses cause** — broken error chain during startup failures

### CRITICAL items (must fix before production deployment with observability requirements)

9. **S3 `health()` always returns `healthy`** — lies to K8s probes
10. **Silent `.env` load failures** — masked configuration errors
11. **Drizzle transaction re-throws raw error type** — loses transaction context
12. **`ConfigNotFoundError` and `LogConfigurationError` defined but unused** — incomplete API surface
13. **MemoryAuthAdapter invalid signature pass-through** — test-only but dangerous

---

## Production Readiness Assessment

**The error handling taxonomy is well-designed but incompletely implemented.** The `CenfError` hierarchy with stable codes is a strong foundation. The `StandardErrorHandlingAdapter` classification map is a good idea. However, **4 critical gaps prevent production readiness:**

1. **Adapters don't consistently use CenfError subtypes** — raw Errors and local duplicate classes break the contract.
2. **Observability is blind to several failure modes** — Redis errors are silently swallowed, S3 health lies, and `wrap()` observability hooks are never triggered.
3. **Classification map is stale** — 5 error codes added in later PRs were never wired into the taxonomy.
4. **No automated enforcement** — there is no lint rule, test, or CI check that verifies every `throw` in production code uses a CenfError subtype. Without this, the taxonomy will continue to drift.

**Recommendation**: Block v0.2.1 release until BLOCKER items 1-6 and 8 are resolved. Address CRITICAL items 9-11. Defer `wrap()` adoption (BLOCKER #7) to v0.3.0 with a dependency injection refactor.
