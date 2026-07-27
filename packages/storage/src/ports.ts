/**
 * StorageManager port interface — object storage abstraction.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/storage/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { StorageMetadata, StorageObject } from './types.js';

/**
 * Storage manager port for object storage operations.
 *
 * Provides put/get/delete/list/exists operations abstracting
 * object stores like S3, GCS, or local filesystem.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface StorageManager extends AsyncLifecycle {
  /**
   * Store an object at the given key.
   *
   * @param key - The object key (path/identifier).
   * @param data - The object content as Buffer or string.
   * @param metadata - Optional metadata (content type, size, etc.).
   */
  put(
    key: string,
    data: Buffer | string,
    metadata?: StorageMetadata,
  ): Promise<void>;

  /**
   * Retrieve an object by key.
   *
   * @param key - The object key.
   * @returns The storage object, or `null` if not found.
   */
  get(key: string): Promise<StorageObject | null>;

  /**
   * Delete an object by key.
   *
   * @param key - The object key.
   */
  delete(key: string): Promise<void>;

  /**
   * List objects with an optional prefix filter.
   *
   * @param prefix - Optional key prefix to filter by.
   * @returns Array of storage objects matching the prefix.
   */
  list(prefix?: string): Promise<StorageObject[]>;

  /**
   * Check if an object exists at the given key.
   *
   * @param key - The object key.
   * @returns `true` if the object exists.
   */
  exists(key: string): Promise<boolean>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const STORAGE_PORT_VERSION = '0.1.0';
