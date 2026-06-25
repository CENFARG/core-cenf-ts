# API Documentation Audit — core-cenf-ts

**Audited files**: `AGENTS.md`, `AGENTS_API.md`, `api-catalog.json`, `src/index.ts`, `src/shared/types.ts`
**Date**: 2026-06-25

---

## HIGH

### H1. api-catalog.json missing 4 managers

`$meta.description` claims "15 transversal managers" but the project has **19**. Missing entries for:
- `secret` — SecretManager
- `error-handling` — ErrorHandlingManager
- `feature-flag` — FeatureFlagManager
- `rate-limiter` — RateLimiterManager

| File | Line |
|------|------|
| `api-catalog.json` | 7, 10 |

**Fix**: Add all 4 managers with methods, errors, and adapters. Update `$meta.description` and `$meta.version` to `0.2.0`.

---

## MEDIUM

### M1. Port interface name mismatch: AGENTS_API.md vs barrel exports

15 of 19 managers use an `I`-prefix in AGENTS_API.md (`ICacheManager`, `IAuthManager`, etc.) but the barrel exports WITHOUT the prefix (`CacheManager`, `AuthManager`). Only `ISecretManager` and `IValidationManager` match.

A reader following AGENTS_API.md will try `import type { ICacheManager }` and fail.

| File | Line |
|------|------|
| `AGENTS_API.md` | 11, 109, 183, 201, 217, 237, 252, 268, 286, 304, 317, 329 |
| `src/index.ts` | 194, 245, 180, 158, 259, 277, 291, 309, 324, 338, 356, 370 |

**Fix**: Align — either rename barrel exports to `I*` or update AGENTS_API.md to match actual export names.

### M2. api-catalog.json adapter name: HttpClient

`api-catalog.json` line 185 lists `"NativeHttpClientAdapter"`, barrel exports `FetchHttpClientAdapter`.

| File | Line |
|------|------|
| `api-catalog.json` | 185 |
| `src/index.ts` | 285 |

**Fix**: Update catalog to `FetchHttpClientAdapter`.

### M3. SecretAccessError documented but not exported

AGENTS_API.md line 60 documents `SecretAccessError`. Not found anywhere in `src/` — neither defined nor exported.

| File | Line |
|------|------|
| `AGENTS_API.md` | 60 |

**Fix**: Either implement and export it, or remove from docs.

### M4. Health types undocumented in barrel

AGENTS_API.md defines `CacheHealth`, `DatabaseHealth`, `EventBusHealth`, `SecretHealth` in its Common Types section. None are exported from the barrel. Consumers who want to type-check `health()` return values must dig into internal modules.

| File | Line |
|------|------|
| `AGENTS_API.md` | 360–380 |
| `src/index.ts` | — (missing) |

**Fix**: Re-export health types from barrel or document as internal.

### M5. AGENTS_API.md auth types vs barrel: name mismatch

AGENTS_API.md defines `TokenPayload`, `TokenOptions`, `VerifyOptions`, `TokenPair`. Barrel exports `JwtPayload`, `TokenConfig` from `managers/auth/types`.

| File | Line |
|------|------|
| `AGENTS_API.md` | 420–440 |
| `src/index.ts` | 182 |

**Fix**: Align type names between documentation and barrel.

---

## LOW

### L1. StoragePresignError exported but undocumented

Barrel line 35 exports `StoragePresignError`. Not in AGENTS_API.md error taxonomy and not in api-catalog.json error lists.

| File | Line |
|------|------|
| `src/index.ts` | 35 |

**Fix**: Add to AGENTS_API.md or remove if unused.

### L2. Missing errors in AGENTS_API.md taxonomy

`FeatureFlagError`, `FeatureFlagNotFoundError`, `RateLimitExceededError` are exported from barrel (lines 237–240) but absent from AGENTS_API.md error tree (lines 72–88).

| File | Line |
|------|------|
| `AGENTS_API.md` | 72–88 |
| `src/index.ts` | 237–240 |

**Fix**: Add to error taxonomy and per-manager error lists.

### L3. Stale PR comment in barrel

Line 234: `// New error classes (PR #4)` — PR-specific context should not live in source.

| File | Line |
|------|------|
| `src/index.ts` | 234 |

**Fix**: Remove the comment.

### L4. api-catalog.json method name: `checkAll` vs `check`

Catalog documents `checkAll()` + `check(name)`. AGENTS_API.md documents `check(): HealthReport` + `check(name): HealthStatus` (overloaded).

| File | Line |
|------|------|
| `api-catalog.json` | 218 |
| `AGENTS_API.md` | 321–322 |

**Fix**: Align method signature docs — which one is correct?

### L5. AGENTS_API.md `handle()` method ambiguity

`handle<T>(fn: () => Promise<T>, options?: HandleOptions): Promise<T>` — the generic `T` propagates poorly through error-handling middleware. Consider revising signature.

| File | Line |
|------|------|
| `AGENTS_API.md` | 67 |

**Fix**: Consider `handle<T>(fn: () => T, ...)` that wraps sync and async transparently, or document the constraint.

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 1     |
| MEDIUM   | 5     |
| LOW      | 5     |

**Overall**: api-catalog.json is the weakest artifact — stale, incomplete, and has an adapter name error. AGENTS_API.md and barrel exports have systematic naming misalignment (I-prefix). The rest is minor drift that accumulates when docs and code evolve independently.
