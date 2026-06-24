import { describe, it, expect } from 'vitest';
import { MemorySecretAdapter } from '../adapters/memory.adapter.js';
import { SecretNotFoundError } from '../errors.js';

describe('MemorySecretAdapter', () => {
  it('set() / get() roundtrip returns stored value', async () => {
    const adapter = new MemorySecretAdapter();
    await adapter.set('API_KEY', 'sk-abc123');
    const value = await adapter.get('API_KEY');
    expect(value).toBe('sk-abc123');
  });

  it('get() throws SecretNotFoundError for unknown name', async () => {
    const adapter = new MemorySecretAdapter();
    await expect(adapter.get('NONEXISTENT')).rejects.toThrow(
      SecretNotFoundError,
    );
  });

  it('get() error message includes the secret name', async () => {
    const adapter = new MemorySecretAdapter();
    await expect(adapter.get('DB_PASSWORD')).rejects.toThrow(
      /DB_PASSWORD/,
    );
  });

  it('has() returns true for existing secret', async () => {
    const adapter = new MemorySecretAdapter();
    await adapter.set('TOKEN', 'jwt-secret');
    expect(await adapter.has('TOKEN')).toBe(true);
  });

  it('has() returns false for unknown secret', async () => {
    const adapter = new MemorySecretAdapter();
    expect(await adapter.has('UNKNOWN')).toBe(false);
  });

  it('list() returns all secret names without values', async () => {
    const adapter = new MemorySecretAdapter();
    await adapter.set('KEY_A', 'value-a');
    await adapter.set('KEY_B', 'value-b');

    const names = await adapter.list();
    expect(names).toContain('KEY_A');
    expect(names).toContain('KEY_B');
    expect(names).toHaveLength(2);
    // Values must NOT appear in the list
    expect(names).not.toContain('value-a');
    expect(names).not.toContain('value-b');
  });

  it('list() returns empty array when no secrets', async () => {
    const adapter = new MemorySecretAdapter();
    const names = await adapter.list();
    expect(names).toEqual([]);
  });

  it('set() overwrites existing value', async () => {
    const adapter = new MemorySecretAdapter();
    await adapter.set('KEY', 'old');
    await adapter.set('KEY', 'new');
    expect(await adapter.get('KEY')).toBe('new');
  });

  it('isolation — separate instances do not share secrets', async () => {
    const a = new MemorySecretAdapter();
    const b = new MemorySecretAdapter();

    await a.set('SHARED', 'from-a');

    // Instance b should NOT see a's secret
    await expect(b.get('SHARED')).rejects.toThrow(SecretNotFoundError);
  });

  it('health() reports memory source as healthy', async () => {
    const adapter = new MemorySecretAdapter();
    await adapter.set('K1', 'v1');

    const h = await adapter.health();
    expect(h.status).toBe('healthy');
    expect(h.details).toHaveProperty('source', 'memory');
    expect(h.details).toHaveProperty('available', true);
  });

  it('start() resolves without error', async () => {
    const adapter = new MemorySecretAdapter();
    await expect(adapter.start()).resolves.toBeUndefined();
  });

  it('stop() resolves without error', async () => {
    const adapter = new MemorySecretAdapter();
    await expect(adapter.stop()).resolves.toBeUndefined();
  });
});
