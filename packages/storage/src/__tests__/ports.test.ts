import { describe, it, expect } from 'vitest';
import {
  STORAGE_PORT_VERSION,
  type StorageManager,
} from '../ports.js';
import type { StorageMetadata, StorageObject } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of StorageManager for contract verification
// ---------------------------------------------------------------------------

class TestStorageManager implements StorageManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async put(
    _key: string,
    _data: Buffer | string,
    _metadata?: StorageMetadata,
  ): Promise<void> {}

  async get(_key: string): Promise<StorageObject | null> {
    return null;
  }

  async delete(_key: string): Promise<void> {}

  async list(_prefix?: string): Promise<StorageObject[]> {
    return [];
  }

  async exists(_key: string): Promise<boolean> {
    return false;
  }
}

// ---------------------------------------------------------------------------
// StorageManager port contract tests
// ---------------------------------------------------------------------------

describe('StorageManager port', () => {
  it('exports a runtime version constant', () => {
    expect(STORAGE_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: StorageManager = new TestStorageManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestStorageManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('put() completes without error', async () => {
    const mgr = new TestStorageManager();
    await expect(
      mgr.put('key1', Buffer.from('data')),
    ).resolves.toBeUndefined();
  });

  it('get() returns null by default', async () => {
    const mgr = new TestStorageManager();
    const result = await mgr.get('nonexistent');
    expect(result).toBeNull();
  });

  it('delete() completes without error', async () => {
    const mgr = new TestStorageManager();
    await expect(mgr.delete('key1')).resolves.toBeUndefined();
  });

  it('list() returns empty array by default', async () => {
    const mgr = new TestStorageManager();
    const result = await mgr.list();
    expect(result).toEqual([]);
  });

  it('exists() returns false by default', async () => {
    const mgr = new TestStorageManager();
    const exists = await mgr.exists('key1');
    expect(exists).toBe(false);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestStorageManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Storage types tests
// ---------------------------------------------------------------------------

describe('Storage types', () => {
  it('StorageObject has key, data, and metadata', () => {
    const obj: StorageObject = {
      key: 'path/to/file.txt',
      data: Buffer.from('content'),
      metadata: { contentType: 'text/plain', size: 7 },
    };
    expect(obj.key).toBe('path/to/file.txt');
    expect(obj.data).toBeInstanceOf(Buffer);
    expect(obj.metadata?.contentType).toBe('text/plain');
  });

  it('StorageObject metadata is optional', () => {
    const obj: StorageObject = {
      key: 'simple.txt',
      data: 'just text',
    };
    expect(obj.metadata).toBeUndefined();
  });

  it('StorageMetadata supports common fields', () => {
    const meta: StorageMetadata = {
      contentType: 'application/json',
      size: 1024,
      lastModified: new Date(),
    };
    expect(meta.contentType).toBe('application/json');
    expect(meta.size).toBe(1024);
  });
});
