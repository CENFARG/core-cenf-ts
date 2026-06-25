/**
 * E2E Smoke Test — 5 core managers, lightweight (<10s), all memory adapters.
 *
 * Managers:
 * - Config (MemoryConfigAdapter)
 * - Logger (MemoryLogAdapter)
 * - Cache (MemoryCacheAdapter)
 * - Auth (MemoryAuthAdapter)
 * - Bootstrap (StandardBootstrapAdapter)
 *
 * Verifies key operations: config.load(), logging.info(), cache.set/get,
 * auth.sign/verify, bootstrap lifecycle.
 *
 * This test is part of the DEFAULT unit test suite (not integration project).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { MemoryConfigAdapter } from '../../src/managers/config/adapters/memory.adapter.js';
import { MemoryLogAdapter } from '../../src/managers/logging/adapters/memory.adapter.js';
import { MemoryCacheAdapter } from '../../src/managers/cache/adapters/memory.adapter.js';
import { MemoryAuthAdapter } from '../../src/managers/auth/adapters/memory.adapter.js';

describe('E2E Smoke — 5 Core Managers', () => {
  let bootstrap: StandardBootstrapAdapter;
  let config: MemoryConfigAdapter;
  let logging: MemoryLogAdapter;
  let cache: MemoryCacheAdapter;
  let auth: MemoryAuthAdapter;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();
    config = new MemoryConfigAdapter({
      APP_NAME: 'core-cenf-e2e',
      NODE_ENV: 'test',
    });
    logging = new MemoryLogAdapter({ component: 'e2e' });
    cache = new MemoryCacheAdapter({ defaultTtlMs: 10_000 });
    auth = new MemoryAuthAdapter({ secret: 'e2e-secret-key' });

    bootstrap.register(config, { priority: 1, name: 'config' });
    bootstrap.register(logging, { priority: 2, name: 'logging' });
    bootstrap.register(auth, { priority: 7, name: 'auth' });
    bootstrap.register(cache, { priority: 8, name: 'cache' });

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  it('bootstrap reports healthy after start', async () => {
    const health = await bootstrap.health();
    expect(health.status).toBe('healthy');
    expect(health.details!.registeredManagers).toHaveLength(4);
  });

  it('config.load() returns typed configuration', async () => {
    const schema = z.object({
      APP_NAME: z.string(),
      NODE_ENV: z.string(),
    });
    const loaded = await config.load(schema);
    expect(loaded.APP_NAME).toBe('core-cenf-e2e');
    expect(loaded.NODE_ENV).toBe('test');
  });

  it('logging.info() captures a structured entry', () => {
    logging.info({ event: 'e2e_smoke' }, 'E2E smoke test running');
    const last = logging.entries[logging.entries.length - 1]!;
    expect(last.level).toBe('info');
    expect(last.msg).toContain('E2E smoke test running');
  });

  it('cache.set() / cache.get() round-trips an object', async () => {
    await cache.set('e2e:user', { id: 1, name: 'E2E User' });
    const value = await cache.get<{ id: number; name: string }>('e2e:user');
    expect(value).toEqual({ id: 1, name: 'E2E User' });
  });

  it('cache.has() confirms existence / non-existence', async () => {
    await cache.set('e2e:flag', true);
    expect(await cache.has('e2e:flag')).toBe(true);
    expect(await cache.has('e2e:missing')).toBe(false);
  });

  it('auth.sign() / auth.verify() round-trip', async () => {
    const token = await auth.sign({ sub: 'e2e-user', role: 'tester' });
    expect(token).toBeTruthy();

    const payload = await auth.verify(token);
    expect(payload.sub).toBe('e2e-user');
    expect(payload.role).toBe('tester');
  });

  it('all individual managers report healthy', async () => {
    expect((await config.health()).status).toBe('healthy');
    expect((await logging.health()).status).toBe('healthy');
    expect((await cache.health()).status).toBe('healthy');
    expect((await auth.health()).status).toBe('healthy');
  });
});
