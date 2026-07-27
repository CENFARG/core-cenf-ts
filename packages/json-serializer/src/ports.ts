/**
 * JsonSerializer port interface — safe JSON serialization.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/json-serializer/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { CustomSerializer } from './types.js';

/**
 * JSON serializer port for BigInt-safe, Date-aware serialization.
 *
 * Extends native `JSON.stringify`/`JSON.parse` with:
 * - BigInt support (serialized as string sentinel)
 * - Date handling (ISO string round-trip)
 * - Custom serializer registration for non-standard types
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface JsonSerializer extends AsyncLifecycle {
  /**
   * Serialize data to a JSON string.
   *
   * Handles BigInt (→ `{"__bigint__":"value"}`), Date (→ `{"__date__":"ISO"}`),
   * and any registered custom serializers automatically.
   *
   * @param data - The data to serialize.
   * @returns The JSON string representation.
   * @throws JsonSerializationError if serialization fails.
   */
  serialize<T = unknown>(data: T): string;

  /**
   * Deserialize a JSON string back to typed data.
   *
   * Revives BigInt sentinels back to `bigint`, Date sentinels back to `Date`,
   * and applies any registered custom deserializers.
   *
   * @param json - The JSON string to parse.
   * @returns The deserialized typed value.
   * @throws JsonDeserializationError if deserialization fails.
   */
  deserialize<T = unknown>(json: string): T;

  /**
   * Register a custom serializer/deserializer for a specific type.
   *
   * Custom serializers are used during `serialize()` and `deserialize()`
   * for values of the registered type.
   *
   * @param type - The type identifier (e.g., 'Point', 'Vector').
   * @param serializer - The custom serializer implementation.
   */
  registerSerializer<T>(
    type: string,
    serializer: CustomSerializer<T>,
  ): void;
}

/** Runtime version constant — ensures module existence for TDD. */
export const JSON_SERIALIZER_PORT_VERSION = '0.1.0';
