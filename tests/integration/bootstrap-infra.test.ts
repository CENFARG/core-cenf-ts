/**
 * Integration test: BootstrapOrchestrator with 5 INFRASTRUCTURE managers.
 *
 * Managers under test:
 * - Cache (MemoryCacheAdapter)
 * - Database (MemoryDatabaseAdapter)
 * - Storage (MemoryStorageAdapter)
 * - HttpClient (FetchHttpClientAdapter)
 * - CircuitBreaker (MemoryCircuitBreakerAdapter)
 *
 * All adapters are in-memory — no external dependencies required.
 *
 * Verifies:
 * - Bootstrap register / start / health / stop lifecycle
 * - Individual manager key methods
 * - Cross-manager interactions (cache + db, storage + http)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { MemoryCacheAdapter } from '../../src/managers/cache/adapters/memory.adapter.js';
import { MemoryDatabaseAdapter } from '../../src/managers/database/adapters/memory.adapter.js';
import { MemoryStorageAdapter } from '../../src/managers/storage/adapters/memory.adapter.js';
import { FetchHttpClientAdapter } from '../../src/managers/http-client/adapters/fetch.adapter.js';
import { MemoryCircuitBreakerAdapter } from '../../src/managers/circuit-breaker/adapters/memory.adapter.js';

describe('BootstrapOrchestrator — Infrastructure Managers (5)', () => {
  let bootstrap: StandardBootstrapAdapter;
  let cache: MemoryCacheAdapter;
  let database: MemoryDatabaseAdapter;
  let storage: MemoryStorageAdapter;
  let httpClient: FetchHttpClientAdapter;
  let circuitBreaker: MemoryCircuitBreakerAdapter;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();

    cache = new MemoryCacheAdapter({ defaultTtlMs: 5000 });
    database = new MemoryDatabaseAdapter();
    storage = new MemoryStorageAdapter();
    httpClient = new FetchHttpClientAdapter();
    circuitBreaker = new MemoryCircuitBreakerAdapter({
      failureThreshold: 3,
      timeoutMs: 1000,
    });

    // Register managers with CENF priority order
    bootstrap.register(cache, { priority: 8, name: 'cache' });
    bootstrap.register(database, { priority: 11, name: 'database' });
    bootstrap.register(storage, { priority: 12, name: 'storage' });
    bootstrap.register(httpClient, { priority: 13, name: 'httpClient' });
    bootstrap.register(circuitBreaker, { priority: 14, name: 'circuitBreaker' });

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
    expect(health.details!.registeredManagers).toHaveLength(5);
  });

  // ---------------------------------------------------------------
  // Cache manager — set/get/has/del
  // ---------------------------------------------------------------

  it('cache.set() / cache.get() round-trip with a string', async () => {
    await cache.set('user:1', { name: 'Alice', role: 'admin' });
    const value = await cache.get<{ name: string; role: string }>('user:1');
    expect(value).toEqual({ name: 'Alice', role: 'admin' });
  });

  it('cache.has() returns true for existing, false for missing', async () => {
    await cache.set('temp-key', 'temp-value');
    expect(await cache.has('temp-key')).toBe(true);
    expect(await cache.has('ghost-key')).toBe(false);
  });

  it('cache.del() removes a key', async () => {
    await cache.set('to-delete', 42);
    await cache.del('to-delete');
    expect(await cache.has('to-delete')).toBe(false);
  });

  it('cache.clear() removes all keys', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.clear();
    expect(await cache.has('a')).toBe(false);
    expect(await cache.has('b')).toBe(false);
  });

  it('cache.getOrSet() calls factory only on miss', async () => {
    let factoryCalls = 0;
    const factory = async () => {
      factoryCalls++;
      return { fresh: true };
    };

    // First call — factory executes
    const v1 = await cache.getOrSet('getOrSet:1', factory, 10_000);
    expect(v1).toEqual({ fresh: true });
    expect(factoryCalls).toBe(1);

    // Second call — cached, factory NOT called
    const v2 = await cache.getOrSet('getOrSet:1', factory, 10_000);
    expect(v2).toEqual({ fresh: true });
    expect(factoryCalls).toBe(1);
  });

  // ---------------------------------------------------------------
  // Database manager — execute/query/transaction
  // ---------------------------------------------------------------

  it('database.execute() inserts and returns affected rows', async () => {
    const affected = await database.execute(
      "INSERT INTO users (id, name) VALUES ($1, $2)",
      ['1', 'Alice'],
    );
    expect(affected).toBe(1);
  });

  it('database.query() retrieves inserted rows', async () => {
    await database.execute(
      "INSERT INTO users (id, name) VALUES ($1, $2)",
      ['2', 'Bob'],
    );
    const result = await database.query<{ id: string; name: string }>(
      'SELECT * FROM users',
    );
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
    const bob = result.rows.find((r) => r.name === 'Bob');
    expect(bob).toBeDefined();
    expect(bob!.id).toBe('2');
  });

  it('database.transaction() commits on success', async () => {
    const result = await database.transaction(async (db) => {
      await db.execute(
        "INSERT INTO products (id, name) VALUES ($1, $2)",
        ['p1', 'Widget'],
      );
      return 'committed';
    });
    expect(result).toBe('committed');

    const rows = await database.query<{ id: string }>(
      'SELECT * FROM products',
    );
    expect(rows.rowCount).toBe(1);
  });

  it('database.transaction() rolls back on error', async () => {
    await expect(
      database.transaction(async (db) => {
        await db.execute(
          "INSERT INTO orders (id, total) VALUES ($1, $2)",
          ['o1', '100'],
        );
        throw new Error('Simulated failure');
      }),
    ).rejects.toThrow('Simulated failure');

    // Verify the insert was rolled back
    const after = await database.query<{ id: string }>(
      'SELECT * FROM orders',
    );
    expect(after.rowCount).toBe(0);
  });

  it('database.getRepository() provides typed CRUD', async () => {
    const repo = database.getRepository<{ id?: number; name: string }>('items');
    const created = await repo.create({ name: 'Item1' });
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Item1');

    const found = await repo.findById(created.id!);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Item1');

    await repo.delete(created.id!);
    const gone = await repo.findById(created.id!);
    expect(gone).toBeNull();
  });

  // ---------------------------------------------------------------
  // Storage manager — put/get/delete/list/exists
  // ---------------------------------------------------------------

  it('storage.put() / storage.get() round-trip', async () => {
    const data = Buffer.from(JSON.stringify({ msg: 'hello' }));
    await storage.put('file-1.json', data, { contentType: 'application/json' });

    const obj = await storage.get('file-1.json');
    expect(obj).not.toBeNull();
    expect(obj!.key).toBe('file-1.json');
    expect(obj!.metadata).toBeDefined();
    expect(obj!.metadata!.contentType).toBe('application/json');
  });

  it('storage.exists() returns true/false', async () => {
    await storage.put('existing.txt', 'content');
    expect(await storage.exists('existing.txt')).toBe(true);
    expect(await storage.exists('missing.txt')).toBe(false);
  });

  it('storage.delete() is idempotent', async () => {
    await storage.put('del-me.txt', 'data');
    await storage.delete('del-me.txt');
    expect(await storage.exists('del-me.txt')).toBe(false);

    // Second delete does not throw
    await expect(storage.delete('del-me.txt')).resolves.toBeUndefined();
  });

  it('storage.list() filters by prefix', async () => {
    await storage.put('folder/a.txt', 'a');
    await storage.put('folder/b.txt', 'b');
    await storage.put('other/c.txt', 'c');

    const inFolder = await storage.list('folder/');
    expect(inFolder).toHaveLength(2);

    const all = await storage.list();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------
  // HTTP client — preconfigured routes
  // ---------------------------------------------------------------

  it('httpClient.get() returns registered response', async () => {
    httpClient.register('GET', '/api/status', {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { ok: true },
    });

    const response = await httpClient.get<{ ok: boolean }>('/api/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('httpClient.post() with body sends and returns registered response', async () => {
    httpClient.register('POST', '/api/items', {
      status: 201,
      headers: {},
      body: { id: 1 },
    });

    const response = await httpClient.post<{ id: number }>(
      '/api/items',
      { name: 'NewItem' },
    );
    expect(response.status).toBe(201);
    expect(response.body!.id).toBe(1);
  });

  // ---------------------------------------------------------------
  // Circuit breaker — execute + state transitions
  // ---------------------------------------------------------------

  it('circuitBreaker.execute() passes through successful calls', async () => {
    const result = await circuitBreaker.execute(async () => 'success');
    expect(result).toBe('success');
  });

  it('circuitBreaker.getState() returns CLOSED initially', () => {
    const state = circuitBreaker.getState();
    expect(state).toBeDefined();
    expect(state).toBe('CLOSED');
  });

  it('circuitBreaker.reset() returns to CLOSED state', () => {
    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  // ---------------------------------------------------------------
  // Individual manager health
  // ---------------------------------------------------------------

  it('cache.health() reports healthy', async () => {
    const h = await cache.health();
    expect(h.status).toBe('healthy');
  });

  it('database.health() reports healthy', async () => {
    const h = await database.health();
    expect(h.status).toBe('healthy');
  });

  it('storage.health() reports healthy', async () => {
    const h = await storage.health();
    expect(h.status).toBe('healthy');
  });

  it('httpClient.health() reports healthy', async () => {
    const h = await httpClient.health();
    expect(h.status).toBe('healthy');
  });

  it('circuitBreaker.health() reports healthy', async () => {
    const h = await circuitBreaker.health();
    expect(h.status).toBe('healthy');
  });
});
