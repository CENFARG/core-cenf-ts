import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorageAdapter } from '../adapters/memory.adapter.js';
import type { StorageManager } from '../ports.js';
import type { StorageObject, StorageMetadata } from '../types.js';

describe('MemoryStorageAdapter', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    await storage.start();
  });

  afterEach(async () => {
    await storage.stop();
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  it('start() initializes the store empty', async () => {
    const h = await storage.health();
    expect(h.status).toBe('healthy');
  });

  it('health() reports adapter type and object count', async () => {
    const h = await storage.health();
    expect(h.status).toBe('healthy');
    expect(h.details.adapter).toBe('memory');
    expect(h.details.objectCount).toBe(0);
  });

  it('stop() clears all data', async () => {
    await storage.put('key1', 'data1');
    await storage.stop();
    const h = await storage.health();
    expect(h.details.objectCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // put() — store objects
  // -----------------------------------------------------------------------

  it('put() stores a string object', async () => {
    await storage.put('file.txt', 'hello world');
    const obj = await storage.get('file.txt');
    expect(obj).not.toBeNull();
    expect(obj!.key).toBe('file.txt');
    expect(obj!.data).toBe('hello world');
  });

  it('put() stores a Buffer object', async () => {
    const buf = Buffer.from([0x01, 0x02, 0x03]);
    await storage.put('binary.bin', buf);
    const obj = await storage.get('binary.bin');
    expect(obj).not.toBeNull();
    expect(Buffer.isBuffer(obj!.data)).toBe(true);
    expect((obj!.data as Buffer).equals(buf)).toBe(true);
  });

  it('put() stores metadata with the object', async () => {
    const meta: StorageMetadata = { contentType: 'application/json', size: 5 };
    await storage.put('data.json', '{"a":1}', meta);
    const obj = await storage.get('data.json');
    expect(obj!.metadata).toBeDefined();
    expect(obj!.metadata?.contentType).toBe('application/json');
    expect(obj!.metadata?.size).toBe(5);
  });

  it('put() overwrites existing key', async () => {
    await storage.put('key', 'old');
    await storage.put('key', 'new');
    const obj = await storage.get('key');
    expect(obj!.data).toBe('new');
  });

  // -----------------------------------------------------------------------
  // get() — retrieve objects
  // -----------------------------------------------------------------------

  it('get() returns null for nonexistent key', async () => {
    const obj = await storage.get('missing');
    expect(obj).toBeNull();
  });

  it('get() returns full StorageObject with key and data', async () => {
    await storage.put('doc.txt', 'content');
    const obj = await storage.get('doc.txt');
    expect(obj).toMatchObject({ key: 'doc.txt', data: 'content' });
  });

  // -----------------------------------------------------------------------
  // delete() — remove objects
  // -----------------------------------------------------------------------

  it('delete() removes an existing object', async () => {
    await storage.put('temp.txt', 'data');
    await storage.delete('temp.txt');
    const obj = await storage.get('temp.txt');
    expect(obj).toBeNull();
  });

  it('delete() is idempotent for nonexistent key', async () => {
    await expect(storage.delete('nonexistent')).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // list() — enumerate objects
  // -----------------------------------------------------------------------

  it('list() returns all objects', async () => {
    await storage.put('a.txt', 'a');
    await storage.put('b.txt', 'b');
    await storage.put('c.txt', 'c');

    const objects = await storage.list();
    expect(objects).toHaveLength(3);
    const keys = objects.map((o) => o.key).sort();
    expect(keys).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('list() returns empty array for empty store', async () => {
    const objects = await storage.list();
    expect(objects).toEqual([]);
  });

  it('list(prefix) filters objects by prefix', async () => {
    await storage.put('images/cat.jpg', 'cat');
    await storage.put('images/dog.jpg', 'dog');
    await storage.put('docs/readme.md', 'readme');

    const images = await storage.list('images/');
    expect(images).toHaveLength(2);
    expect(images.map((o) => o.key).sort()).toEqual([
      'images/cat.jpg',
      'images/dog.jpg',
    ]);
  });

  it('list(prefix) returns empty when no matches', async () => {
    await storage.put('a.txt', 'a');
    const result = await storage.list('unknown/');
    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // exists() — check object presence
  // -----------------------------------------------------------------------

  it('exists() returns true for existing object', async () => {
    await storage.put('key', 'value');
    const exists = await storage.exists('key');
    expect(exists).toBe(true);
  });

  it('exists() returns false for nonexistent object', async () => {
    const exists = await storage.exists('missing');
    expect(exists).toBe(false);
  });

  it('exists() returns false after delete', async () => {
    await storage.put('key', 'value');
    await storage.delete('key');
    const exists = await storage.exists('key');
    expect(exists).toBe(false);
  });
});
