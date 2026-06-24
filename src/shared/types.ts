/**
 * Shared core types for core-cenf-ts.
 *
 * These types form the foundation for all manager interfaces,
 * error handling, and data exchange across the library.
 *
 * @module shared/types
 */

// ---------------------------------------------------------------------------
// JSON types — recursive type-safe JSON representations
// ---------------------------------------------------------------------------

/**
 * Recursive type representing any valid JSON value.
 *
 * Mirrors what `JSON.parse` / `JSON.stringify` produce,
 * with full nesting support.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * A JSON object — a flat `Record<string, JsonValue>`.
 *
 * Named for use in typed API surfaces where nested
 * or recursive JSON is not expected.
 */
export type JsonObject = Record<string, JsonValue>;

// ---------------------------------------------------------------------------
// Result type — Rust-style discriminated union
// ---------------------------------------------------------------------------

/**
 * Discriminated union for success or failure results.
 *
 * Avoids throwing errors for expected failure paths.
 * Pattern: check `result.ok` to narrow to `Success<T>` or `Failure<E>`.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ---------------------------------------------------------------------------
// Health status
// ---------------------------------------------------------------------------

/**
 * Health check status for any manager or system component.
 *
 * Used by `AsyncLifecycle.health()` and `HealthManager`.
 */
export type HealthStatus = {
  /** One of: healthy, degraded, unhealthy. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Arbitrary details about the health check. */
  details: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Context store — per-request / per-operation state
// ---------------------------------------------------------------------------

/**
 * Context data stored in `AsyncLocalStorage` and propagated
 * across async operations (correlation, tenant, user).
 */
export interface ContextStore {
  /** Unique correlation ID for tracing requests. */
  correlationId: string;
  /** Optional tenant identifier for multi-tenant setups. */
  tenantId?: string;
  /** Optional user identifier for the current operation. */
  userId?: string;
}

// ---------------------------------------------------------------------------
// Runtime exports — force module existence for TDD / barrel testing
// ---------------------------------------------------------------------------

/**
 * @internal Type identity symbol — ensures this module has a runtime presence
 * and can be imported as a value (not just a type).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
declare const TYPE_BRAND: unique symbol;

/**
 * Runtime type brand attached to `JsonValue` to force module load
 * for TDD verification and barrel export tests.
 *
 * This is a compile-time-only construct — it does not exist at runtime.
 * Import as a value to ensure the module is resolved.
 */
export type JsonValueBrand = { readonly [TYPE_BRAND]: 'core-cenf-ts/types' };

// Re-export JsonValue as a value for runtime verification
// (TypeScript dual-emit pattern: same name for type and const)
export const JsonValue = null as unknown as JsonValueBrand;
