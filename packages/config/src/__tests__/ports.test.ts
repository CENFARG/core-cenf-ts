import { describe, it, expect } from 'vitest';
import { IConfigManager, CONFIG_PORT_VERSION } from '../ports.js';
import type { AsyncLifecycle, HealthStatus } from '@cenf/core';
import { z } from 'zod';

/** Test implementation of IConfigManager for contract verification. */
class TestConfigManager implements IConfigManager {
  private store = new Map<string, unknown>();

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async load<T>(schema: z.ZodSchema<T>): Promise<T> {
    const raw = Object.fromEntries(this.store) as Record<string, unknown>;
    return schema.parse(raw);
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  async reload(): Promise<void> {
    // No-op in test implementation
  }
}

describe('IConfigManager port', () => {
  it('exports runtime version constant', () => {
    expect(CONFIG_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: IConfigManager = new TestConfigManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestConfigManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('load() validates and returns typed config', async () => {
    const mgr = new TestConfigManager();
    mgr.set('PORT', '3000');
    mgr.set('HOST', 'localhost');
    const schema = z.object({ PORT: z.string(), HOST: z.string() });
    const config = await mgr.load(schema);
    expect(config.PORT).toBe('3000');
    expect(config.HOST).toBe('localhost');
  });

  it('load() throws on validation failure', async () => {
    const mgr = new TestConfigManager();
    const schema = z.object({ REQUIRED_KEY: z.string() });
    await expect(mgr.load(schema)).rejects.toThrow();
  });

  it('get() returns set value', () => {
    const mgr = new TestConfigManager();
    mgr.set('KEY', 'value');
    expect(mgr.get('KEY')).toBe('value');
  });

  it('get() returns undefined for missing key', () => {
    const mgr = new TestConfigManager();
    expect(mgr.get('MISSING')).toBeUndefined();
  });

  it('set() overwrites existing value', () => {
    const mgr = new TestConfigManager();
    mgr.set('KEY', 'first');
    mgr.set('KEY', 'second');
    expect(mgr.get('KEY')).toBe('second');
  });

  it('reload() is callable', async () => {
    const mgr = new TestConfigManager();
    await expect(mgr.reload()).resolves.toBeUndefined();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestConfigManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});
