/**
 * JsonSerializer-specific types.
 *
 * Types for custom serializers, configuration, and options.
 *
 * @module managers/json-serializer/types
 */

// ---------------------------------------------------------------------------
// CustomSerializer — user-defined type serialization
// ---------------------------------------------------------------------------

/**
 * Custom serializer for non-standard types (e.g., Point, Money).
 *
 * Implement this interface to add serialization support for
 * types that `JSON.stringify` cannot handle natively.
 *
 * @typeParam T - The type this serializer handles.
 */
export interface CustomSerializer<T> {
  /**
   * Serialize a value of type T to a string.
   *
   * @param value - The value to serialize.
   * @returns The string representation.
   */
  serialize(value: T): string;

  /**
   * Deserialize a string back to type T.
   *
   * @param value - The string to deserialize.
   * @returns The reconstructed typed value.
   */
  deserialize(value: string): T;
}

// ---------------------------------------------------------------------------
// SerializerConfig — runtime configuration
// ---------------------------------------------------------------------------

/**
 * Runtime configuration for the JsonSerializer.
 */
export interface SerializerConfig {
  /** Map of type name → custom serializer. */
  serializers: Record<string, CustomSerializer<unknown>>;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const JSON_SERIALIZER_TYPES_VERSION = '0.1.0';
