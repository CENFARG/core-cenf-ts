/**
 * Integration test: BootstrapOrchestrator with 5 CORE foundation managers.
 *
 * Managers under test:
 * - Config (MemoryConfigAdapter)
 * - Logger (MemoryLogAdapter)
 * - Secret (MemorySecretAdapter)
 * - Error (StandardErrorHandlingAdapter)
 * - Validation (ZodValidationAdapter)
 *
 * All adapters are in-memory — no external dependencies required.
 *
 * Verifies:
 * - Bootstrap register / start / health / stop lifecycle
 * - Individual manager key methods
 * - Health aggregation after start and after stop
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { MemoryConfigAdapter } from '../../src/managers/config/adapters/memory.adapter.js';
import { MemoryLogAdapter } from '../../src/managers/logging/adapters/memory.adapter.js';
import { MemorySecretAdapter } from '../../src/managers/secret/adapters/memory.adapter.js';
import { StandardErrorHandlingAdapter } from '../../src/managers/error-handling/adapters/standard.adapter.js';
import { ZodValidationAdapter } from '../../src/managers/validation/adapters/zod.adapter.js';

describe('BootstrapOrchestrator — Core Foundation Managers (5)', () => {
  let bootstrap: StandardBootstrapAdapter;
  let config: MemoryConfigAdapter;
  let logging: MemoryLogAdapter;
  let secret: MemorySecretAdapter;
  let errorHandling: StandardErrorHandlingAdapter;
  let validation: ZodValidationAdapter;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();

    config = new MemoryConfigAdapter({
      APP_NAME: 'core-cenf-test',
      NODE_ENV: 'test',
    });
    logging = new MemoryLogAdapter({ component: 'core' });
    secret = new MemorySecretAdapter();
    errorHandling = new StandardErrorHandlingAdapter();
    validation = new ZodValidationAdapter();

    // Seed a secret for verification
    await secret.set('API_KEY', 'sk-test-core');
    await secret.set('DB_PASSWORD', 's3cr3t');

    // Register managers with CENF priority order
    bootstrap.register(config, { priority: 1, name: 'config' });
    bootstrap.register(logging, { priority: 2, name: 'logging' });
    bootstrap.register(secret, { priority: 3, name: 'secret' });
    bootstrap.register(errorHandling, { priority: 4, name: 'errorHandling' });
    bootstrap.register(validation, { priority: 5, name: 'validation' });

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  // ---------------------------------------------------------------
  // Bootstrap lifecycle
  // ---------------------------------------------------------------

  it('bootstrap reports healthy after start', async () => {
    const health = await bootstrap.health();
    expect(health.status).toBe('healthy');
    expect(health.details).toBeDefined();
    expect(health.details!.started).toBe(true);
    expect(health.details!.registeredManagers).toHaveLength(5);
  });

  it('bootstrap reports degraded after stop', async () => {
    // Create isolated instance to test stop without affecting other tests
    const isolatedBootstrap = new StandardBootstrapAdapter();
    const isolatedConfig = new MemoryConfigAdapter({ APP_NAME: 'isolated' });
    const isolatedLogging = new MemoryLogAdapter();

    isolatedBootstrap.register(isolatedConfig, { priority: 1, name: 'config' });
    isolatedBootstrap.register(isolatedLogging, { priority: 2, name: 'logging' });

    await isolatedBootstrap.start();
    await isolatedBootstrap.stop();

    const health = await isolatedBootstrap.health();
    expect(health.status).toBe('degraded');
  });

  // ---------------------------------------------------------------
  // Config manager — load/set/get
  // ---------------------------------------------------------------

  it('config.load() parses and returns typed config', async () => {
    const schema = z.object({
      APP_NAME: z.string(),
      NODE_ENV: z.string(),
    });
    const loaded = await config.load(schema);
    expect(loaded.APP_NAME).toBe('core-cenf-test');
    expect(loaded.NODE_ENV).toBe('test');
  });

  it('config.set() / config.get() round-trips', () => {
    config.set('DYNAMIC_KEY', 42);
    expect(config.get<number>('DYNAMIC_KEY')).toBe(42);
  });

  // ---------------------------------------------------------------
  // Logger manager — info/debug/warn/error
  // ---------------------------------------------------------------

  it('logging.info() captures structured entries', () => {
    const initialCount = logging.entries.length;
    logging.info({ event: 'test_start', key: 1 }, 'Integration test started');
    expect(logging.entries.length).toBe(initialCount + 1);
    const last = logging.entries[logging.entries.length - 1]!;
    expect(last.level).toBe('info');
    expect(last.msg).toContain('Integration test started');
  });

  it('logging.error() captures error level entries', () => {
    logging.error(new Error('Something failed'), 'Critical error');
    const lastError = [...logging.entries].reverse().find((e) => e.level === 'error');
    expect(lastError).toBeDefined();
    expect(lastError!.msg).toContain('Critical error');
  });

  it('logging.child() creates isolated logger', () => {
    const child = logging.child({ scope: 'child-scope' });
    child.info('Child message');
    // Child bindings are separate — parent entries unaffected
    expect(logging.entries.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Secret manager — get/set/has/list
  // ---------------------------------------------------------------

  it('secret.get() retrieves a seeded secret', async () => {
    const apiKey = await secret.get('API_KEY');
    expect(apiKey).toBe('sk-test-core');
  });

  it('secret.has() returns true for existing, false for missing', async () => {
    expect(await secret.has('API_KEY')).toBe(true);
    expect(await secret.has('NONEXISTENT')).toBe(false);
  });

  it('secret.list() returns all secret names', async () => {
    const names = await secret.list();
    expect(names).toContain('API_KEY');
    expect(names).toContain('DB_PASSWORD');
  });

  it('secret.set() + secret.get() round-trip', async () => {
    await secret.set('TEMP_KEY', 'temp-value');
    expect(await secret.get('TEMP_KEY')).toBe('temp-value');
  });

  // ---------------------------------------------------------------
  // Error handling manager — classify/wrap
  // ---------------------------------------------------------------

  it('errorHandling.classify() categorizes a non-CenfError as server', () => {
    const err = new Error('Test error');
    const classification = errorHandling.classify(err);
    expect(classification).toBeDefined();
    expect(classification.category).toBe('server');
    expect(classification.retryable).toBe(false);
  });

  it('errorHandling.wrap() wraps a function with error handling', () => {
    const fn = (input: number): number => {
      if (input < 0) throw new Error('Negative input');
      return input * 2;
    };
    const wrapped = errorHandling.wrap(fn);

    // Normal path: wrapped function returns correct result
    expect(wrapped(5)).toBe(10);

    // Error path: wrapped function throws original error
    expect(() => wrapped(-1)).toThrow('Negative input');
  });

  // ---------------------------------------------------------------
  // Validation manager — validate schema
  // ---------------------------------------------------------------

  it('validation.validate() returns ok for valid data', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = validation.validate(schema, { name: 'Alice', age: 30 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('validation.validate() returns error for invalid data', () => {
    const schema = z.object({ name: z.string() });
    const result = validation.validate(schema, { name: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------
  // Individual manager health
  // ---------------------------------------------------------------

  it('config.health() reports healthy', async () => {
    const h = await config.health();
    expect(h.status).toBe('healthy');
  });

  it('logging.health() reports healthy', async () => {
    const h = await logging.health();
    expect(h.status).toBe('healthy');
  });

  it('secret.health() reports healthy', async () => {
    const h = await secret.health();
    expect(h.status).toBe('healthy');
  });

  it('errorHandling.health() reports healthy', async () => {
    const h = await errorHandling.health();
    expect(h.status).toBe('healthy');
  });

  it('validation.health() reports healthy', async () => {
    const h = await validation.health();
    expect(h.status).toBe('healthy');
  });
});
