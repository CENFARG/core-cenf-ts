import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MemoryConfigAdapter } from '../adapters/memory.adapter.js';

const testSchema = z.object({
  APP_NAME: z.string().default('my-app'),
  PORT: z.coerce.number().default(8080),
});

describe('MemoryConfigAdapter', () => {
  it('set() / get() roundtrip', () => {
    const adapter = new MemoryConfigAdapter();
    adapter.set('KEY', 'value');
    expect(adapter.get('KEY')).toBe('value');
  });

  it('get() returns undefined for missing key', () => {
    const adapter = new MemoryConfigAdapter();
    expect(adapter.get('MISSING')).toBeUndefined();
  });

  it('set() overwrites existing value', () => {
    const adapter = new MemoryConfigAdapter();
    adapter.set('KEY', 'first');
    adapter.set('KEY', 'second');
    expect(adapter.get('KEY')).toBe('second');
  });

  it('load() returns typed config from previously set values', async () => {
    const adapter = new MemoryConfigAdapter();
    adapter.set('APP_NAME', 'test-app');
    adapter.set('PORT', '3000');

    const config = await adapter.load(testSchema);
    expect(config.APP_NAME).toBe('test-app');
    expect(config.PORT).toBe(3000);
  });

  it('load() applies defaults for unset values', async () => {
    const adapter = new MemoryConfigAdapter();
    // Set nothing — should use defaults
    const config = await adapter.load(testSchema);
    expect(config.APP_NAME).toBe('my-app');
    expect(config.PORT).toBe(8080);
  });

  it('supports setting values of any type via set()', () => {
    const adapter = new MemoryConfigAdapter();
    adapter.set('COUNT', 42);
    adapter.set('FLAG', true);
    adapter.set('OBJ', { nested: true });

    expect(adapter.get<number>('COUNT')).toBe(42);
    expect(adapter.get<boolean>('FLAG')).toBe(true);
    expect(adapter.get('OBJ')).toEqual({ nested: true });
  });

  it('implements AsyncLifecycle start/stop/health', async () => {
    const adapter = new MemoryConfigAdapter();
    adapter.set('PORT', '9090');

    await adapter.start();
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details).toHaveProperty('keysLoaded');
    expect(health.details.keysLoaded).toBe(1);

    await adapter.stop();
  });

  it('health() reports empty store', async () => {
    const adapter = new MemoryConfigAdapter();
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details.keysLoaded).toBe(0);
  });

  it('constructor accepts initial config data', () => {
    const adapter = new MemoryConfigAdapter({
      FOO: 'bar',
      BAZ: 42,
    });
    expect(adapter.get('FOO')).toBe('bar');
    expect(adapter.get('BAZ')).toBe(42);
  });
});
