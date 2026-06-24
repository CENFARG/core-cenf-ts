/**
 * Native JSON serializer adapter — BigInt-safe and Date-aware.
 *
 * Implements the JsonSerializer port with custom pre-processing
 * for BigInt → string and Date → ISO string round-trips.
 *
 * @module managers/json-serializer/adapters/native.adapter
 */

import type { JsonSerializer } from '../ports.js';
import type { CustomSerializer } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

/** Sentinel key for BigInt serialization. */
const BIGINT_KEY = '__bigint__';

/** Sentinel key for Date serialization. */
const DATE_KEY = '__date__';

/**
 * Native JSON serializer with BigInt and Date support.
 *
 * Features:
 * - BigInt serialized as `{"__bigint__":"<value>"}` and revived
 * - Date serialized as `{"__date__":"<ISO string>"}` and revived
 * - Custom serializer registration for non-standard types
 *
 * Uses a pre-processing step for serialization because `JSON.stringify`
 * calls `Date.prototype.toJSON()` before the replacer, which would
 * convert Dates to strings irreversibly. Pre-processing walks the
 * object tree and replaces Dates/BigInts with sentinel objects before
 * calling `JSON.stringify`.
 *
 * Use this adapter:
 * - As the primary JSON serializer for all CENF projects
 * - When BigInt and Date round-trip fidelity is required
 * - As a reference implementation for the JsonSerializer port
 */
export class NativeJsonSerializer implements JsonSerializer {
  /** Registered custom serializers (type name → serializer). */
  private readonly customSerializers = new Map<
    string,
    CustomSerializer<unknown>
  >();

  /** Whether the adapter has been started. */
  private started = false;

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.customSerializers.clear();
    this.started = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'native',
        started: this.started,
        customSerializers: this.customSerializers.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // JsonSerializer — serialize
  // -----------------------------------------------------------------------

  serialize<T = unknown>(data: T): string {
    const processed = this.preProcess(data);
    return JSON.stringify(processed);
  }

  // -----------------------------------------------------------------------
  // JsonSerializer — deserialize
  // -----------------------------------------------------------------------

  deserialize<T = unknown>(json: string): T {
    return JSON.parse(json, this.reviver.bind(this)) as T;
  }

  // -----------------------------------------------------------------------
  // JsonSerializer — registerSerializer
  // -----------------------------------------------------------------------

  registerSerializer<T>(
    type: string,
    serializer: CustomSerializer<T>,
  ): void {
    this.customSerializers.set(type, serializer as CustomSerializer<unknown>);
  }

  // -----------------------------------------------------------------------
  // Private: pre-processing for serialization
  // -----------------------------------------------------------------------

  /**
   * Walk the object tree and replace non-serializable values
   * with sentinel objects before calling `JSON.stringify`.
   *
   * This is necessary because `JSON.stringify` calls `toJSON()` on
   * Date objects before the replacer, which would irreversibly
   * convert Dates to strings.
   */
  private preProcess(value: unknown): unknown {
    // BigInt → sentinel
    if (typeof value === 'bigint') {
      return { [BIGINT_KEY]: value.toString() };
    }

    // Date → sentinel
    if (value instanceof Date) {
      return { [DATE_KEY]: value.toISOString() };
    }

    // Arrays → recurse
    if (Array.isArray(value)) {
      return value.map((v) => this.preProcess(v));
    }

    // Objects → recurse into own properties
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        result[key] = this.preProcess(val);
      }
      return result;
    }

    // Primitives and null → pass through
    return value;
  }

  // -----------------------------------------------------------------------
  // Private: JSON.parse reviver
  // -----------------------------------------------------------------------

  /**
   * Custom reviver for JSON.parse.
   *
   * Revives:
   * - `{__bigint__: "<value>"}` → BigInt (only if exactly one key)
   * - `{__date__: "<ISO string>"}` → Date (only if exactly one key)
   * - Any registered custom serializer (only if exactly one sentinel key)
   */
  private reviver(_key: string, value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Must be a sentinel object with exactly one key
    if (keys.length !== 1) {
      return value;
    }

    const [sentinelKey] = keys;

    // BigInt sentinel
    if (sentinelKey === BIGINT_KEY && typeof obj[BIGINT_KEY] === 'string') {
      return BigInt(obj[BIGINT_KEY]);
    }

    // Date sentinel
    if (sentinelKey === DATE_KEY && typeof obj[DATE_KEY] === 'string') {
      return new Date(obj[DATE_KEY]);
    }

    // Custom serializer sentinel
    const custom = this.customSerializers.get(sentinelKey);
    if (custom && typeof obj[sentinelKey] === 'string') {
      return custom.deserialize(obj[sentinelKey]);
    }

    return value;
  }
}
