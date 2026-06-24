import { describe, it, expect, beforeEach } from 'vitest';
import { EnvSecretAdapter } from '../adapters/env.adapter.js';
import { SecretNotFoundError } from '../errors.js';

describe('EnvSecretAdapter', () => {
  beforeEach(() => {
    // Clean up test env vars
    delete process.env['TEST_SECRET_A'];
    delete process.env['TEST_SECRET_B'];
    delete process.env['CENF_SECRET_SOURCE'];
  });

  it('get() retrieves value from process.env', async () => {
    process.env['TEST_SECRET_A'] = 'my-secret-value';
    const adapter = new EnvSecretAdapter();
    const value = await adapter.get('TEST_SECRET_A');
    expect(value).toBe('my-secret-value');
  });

  it('get() throws SecretNotFoundError for missing env var', async () => {
    const adapter = new EnvSecretAdapter();
    await expect(adapter.get('NONEXISTENT_SECRET')).rejects.toThrow(
      SecretNotFoundError,
    );
  });

  it('get() error message does NOT contain secret value for other lookups', async () => {
    process.env['KNOWN'] = 'sensitive-data';
    const adapter = new EnvSecretAdapter();
    // Error for a different key must not leak KNOWN's value
    await expect(adapter.get('MISSING')).rejects.toThrow(/MISSING/);
    // Ensure the error message does NOT contain the sensitive value
    await expect(adapter.get('MISSING')).rejects.not.toThrow(
      /sensitive-data/,
    );
  });

  it('set() stores value without mutating process.env', async () => {
    const adapter = new EnvSecretAdapter();
    await adapter.set('RUNTIME_KEY', 'runtime-value');
    // Should be retrievable via adapter
    expect(await adapter.get('RUNTIME_KEY')).toBe('runtime-value');
    // Should NOT be in process.env
    expect(process.env['RUNTIME_KEY']).toBeUndefined();
  });

  it('set() overwrites an existing env var in-memory only', async () => {
    process.env['OVERRIDE_ME'] = 'original';
    const adapter = new EnvSecretAdapter();
    await adapter.set('OVERRIDE_ME', 'overridden');
    expect(await adapter.get('OVERRIDE_ME')).toBe('overridden');
    // process.env remains unchanged
    expect(process.env['OVERRIDE_ME']).toBe('original');
  });

  it('has() returns true for existing env var', async () => {
    process.env['HAS_TEST'] = 'present';
    const adapter = new EnvSecretAdapter();
    expect(await adapter.has('HAS_TEST')).toBe(true);
  });

  it('has() returns false for missing env var', async () => {
    const adapter = new EnvSecretAdapter();
    expect(await adapter.has('DEFINITELY_NOT_SET')).toBe(false);
  });

  it('has() returns true for runtime-set value', async () => {
    const adapter = new EnvSecretAdapter();
    await adapter.set('DYNAMIC', 'val');
    expect(await adapter.has('DYNAMIC')).toBe(true);
  });

  it('list() includes both env vars and runtime-set keys', async () => {
    process.env['ENV_A'] = 'a';
    process.env['ENV_B'] = 'b';
    const adapter = new EnvSecretAdapter();
    await adapter.set('RUNTIME_C', 'c');

    const names = await adapter.list();
    expect(names).toContain('ENV_A');
    expect(names).toContain('ENV_B');
    expect(names).toContain('RUNTIME_C');
  });

  it('list() does NOT include secret values', async () => {
    process.env['SECRET_X'] = 'super-secret-123';
    const adapter = new EnvSecretAdapter();
    const names = await adapter.list();
    expect(names).not.toContain('super-secret-123');
  });

  it('health() reports env source as available', async () => {
    const adapter = new EnvSecretAdapter();
    const h = await adapter.health();
    expect(h.status).toBe('healthy');
    expect(h.details).toHaveProperty('source', 'env');
    expect(h.details).toHaveProperty('available', true);
  });

  it('start() resolves without error', async () => {
    const adapter = new EnvSecretAdapter();
    await expect(adapter.start()).resolves.toBeUndefined();
  });

  it('stop() resolves without error', async () => {
    const adapter = new EnvSecretAdapter();
    await expect(adapter.stop()).resolves.toBeUndefined();
  });
});
