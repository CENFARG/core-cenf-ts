/**
 * In-memory storage adapter — Map-based object store for testing.
 *
 * Implements the StorageManager port with no external dependencies.
 * Stores objects as `StorageObject` entries in a `Map<string, StorageObject>`.
 * Suitable for testing and as a reference implementation.
 *
 * @module managers/storage/adapters/memory.adapter
 */

import type { StorageManager } from '../ports.js';
import type { StorageObject, StorageMetadata } from '../types.js';
import type { HealthStatus } from '@cenf/core';

/**
 * In-memory storage adapter backed by a native `Map`.
 *
 * Each object is stored with its key, data (Buffer or string),
 * and optional metadata. Supports put, get, delete, list
 * with prefix filtering, and existence checks.
 *
 * Use this adapter:
 * - In unit tests where cloud storage is not available
 * - For prototyping and rapid iteration
 * - As a reference implementation for the StorageManager port
 */
export class MemoryStorageAdapter implements StorageManager {
  /** Object store: key → StorageObject. */
  private store = new Map<string, StorageObject>();

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.store.clear();
  }

  async stop(): Promise<void> {
    this.store.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        objectCount: this.store.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // StorageManager — put
  // -----------------------------------------------------------------------

  async put(
    key: string,
    data: Buffer | string,
    metadata?: StorageMetadata,
  ): Promise<void> {
    this.store.set(key, { key, data, metadata });
  }

  // -----------------------------------------------------------------------
  // StorageManager — get
  // -----------------------------------------------------------------------

  async get(key: string): Promise<StorageObject | null> {
    return this.store.get(key) ?? null;
  }

  // -----------------------------------------------------------------------
  // StorageManager — delete
  // -----------------------------------------------------------------------

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // -----------------------------------------------------------------------
  // StorageManager — list
  // -----------------------------------------------------------------------

  async list(prefix?: string): Promise<StorageObject[]> {
    const all = Array.from(this.store.values());
    if (prefix === undefined) return all;
    return all.filter((obj) => obj.key.startsWith(prefix));
  }

  // -----------------------------------------------------------------------
  // StorageManager — exists
  // -----------------------------------------------------------------------

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
