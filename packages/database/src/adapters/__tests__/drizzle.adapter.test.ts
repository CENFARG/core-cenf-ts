import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { DrizzleDatabaseAdapter } from '../drizzle.adapter.js';
import { DatabaseConnectionError, DatabaseQueryError } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test setup — SQLite in-memory via @libsql/client
// ---------------------------------------------------------------------------

let client: Client;

beforeAll(async () => {
  // Create an in-memory SQLite database for testing
  client = createClient({ url: ':memory:' });
});

afterAll(async () => {
  client.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh DrizzleDatabaseAdapter wrapping the test database. */
function makeAdapter(
  url = ':memory:',
): DrizzleDatabaseAdapter {
  return new DrizzleDatabaseAdapter({ url });
}

// ---------------------------------------------------------------------------
// DrizzleDatabaseAdapter — Connection & Lifecycle
// ---------------------------------------------------------------------------

describe('DrizzleDatabaseAdapter — connection & lifecycle', () => {
  it('start() initializes and runs schema migration', async () => {
    const adapter = makeAdapter();
    await expect(adapter.start()).resolves.toBeUndefined();
  });

  it('start() rejects with DatabaseConnectionError on invalid URL', async () => {
    const adapter = new DrizzleDatabaseAdapter({
      url: 'invalid://bad:9999',
    });
    await expect(adapter.start()).rejects.toThrow(DatabaseConnectionError);
  });

  it('health() reports healthy after start()', async () => {
    const adapter = makeAdapter();
    await adapter.start();
    const health = await adapter.health();
    expect(health.status).toBe('healthy');
    expect(health.details).toHaveProperty('adapter', 'drizzle');
  });

  it('stop() closes the connection', async () => {
    const adapter = makeAdapter();
    await adapter.start();
    await expect(adapter.stop()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DrizzleDatabaseAdapter — raw query (query + execute)
// ---------------------------------------------------------------------------

describe('DrizzleDatabaseAdapter — raw query', () => {
  let adapter: DrizzleDatabaseAdapter;

  beforeAll(async () => {
    adapter = new DrizzleDatabaseAdapter({ url: ':memory:' });
    await adapter.start();
  });

  it('query() returns rows from a SELECT', async () => {
    // Use drizzle to create a table and insert data
    const result = await adapter.query<{ value: number }>(
      "SELECT 1 AS value",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBe(1);
    expect(result.rowCount).toBe(1);
    expect(result.fields).toHaveLength(1);
  });

  it('query() returns empty rows when no data matches', async () => {
    const result = await adapter.query<{ x: number }>(
      "SELECT 1 AS x WHERE 1 = 0",
    );
    expect(result.rows).toHaveLength(0);
    expect(result.rowCount).toBe(0);
  });

  it('execute() returns affected row count for DDL', async () => {
    const count = await adapter.execute(
      'CREATE TABLE IF NOT EXISTS test_exec (id INTEGER PRIMARY KEY, name TEXT)',
    );
    // DDL may return 0 affected rows, but should not throw
    expect(typeof count).toBe('number');
  });

  it('execute() inserts and returns row count', async () => {
    await adapter.execute(
      'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)',
    );
    const count = await adapter.execute(
      "INSERT INTO users (name) VALUES ('Alice')",
    );
    expect(count).toBe(1);
  });

  it('query() rejects invalid SQL with DatabaseQueryError', async () => {
    await expect(
      adapter.query('SELECT * FROM nonexistent_table'),
    ).rejects.toThrow(DatabaseQueryError);
  });
});

// ---------------------------------------------------------------------------
// DrizzleDatabaseAdapter — GenericRepository<T>
// ---------------------------------------------------------------------------

describe('DrizzleDatabaseAdapter — GenericRepository<T>', () => {
  let adapter: DrizzleDatabaseAdapter;

  beforeAll(async () => {
    adapter = new DrizzleDatabaseAdapter({ url: ':memory:' });
    await adapter.start();
    // Create table for CRUD tests
    await adapter.execute(
      'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL)',
    );
  });

  interface Product {
    id: number;
    name: string;
    price: number;
  }

  it('getRepository() returns a GenericRepository instance', () => {
    const repo = adapter.getRepository<Product>('products');
    expect(repo).toBeDefined();
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findAll).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
    expect(repo.delete).toBeInstanceOf(Function);
  });

  it('create() inserts and returns the entity with id', async () => {
    const repo = adapter.getRepository<Product>('products');
    const product = await repo.create({ name: 'Widget', price: 9.99 });
    expect(product.id).toBeGreaterThan(0);
    expect(product.name).toBe('Widget');
    expect(product.price).toBe(9.99);
  });

  it('findById() returns the entity by primary key', async () => {
    const repo = adapter.getRepository<Product>('products');
    const created = await repo.create({ name: 'Gadget', price: 19.99 });
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Gadget');
  });

  it('findById() returns null for missing id', async () => {
    const repo = adapter.getRepository<Product>('products');
    const found = await repo.findById(99999);
    expect(found).toBeNull();
  });

  it('findAll() returns all entities', async () => {
    const repo = adapter.getRepository<Product>('products');
    const all = await repo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('update() modifies and returns the updated entity', async () => {
    const repo = adapter.getRepository<Product>('products');
    const created = await repo.create({ name: 'OldName', price: 5.0 });
    const updated = await repo.update(created.id, { name: 'NewName', price: 12.5 });
    expect(updated.name).toBe('NewName');
    expect(updated.price).toBe(12.5);
    expect(updated.id).toBe(created.id);
  });

  it('delete() removes the entity (idempotent)', async () => {
    const repo = adapter.getRepository<Product>('products');
    const created = await repo.create({ name: 'ToDelete', price: 1.0 });
    await expect(repo.delete(created.id)).resolves.toBeUndefined();
    const found = await repo.findById(created.id);
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DrizzleDatabaseAdapter — transactions
// ---------------------------------------------------------------------------

describe('DrizzleDatabaseAdapter — transactions', () => {
  let adapter: DrizzleDatabaseAdapter;

  beforeAll(async () => {
    adapter = new DrizzleDatabaseAdapter({ url: ':memory:' });
    await adapter.start();
    await adapter.execute(
      'CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, balance REAL NOT NULL)',
    );
  });

  it('transaction() commits on success', async () => {
    const result = await adapter.transaction(async (tx) => {
      await tx.execute(
        "INSERT INTO accounts (balance) VALUES (100.0)",
      );
      return 'committed';
    });
    expect(result).toBe('committed');

    // Verify the insert persisted
    const rows = await adapter.query<{ balance: number }>(
      'SELECT balance FROM accounts',
    );
    expect(rows.rows.length).toBeGreaterThan(0);
  });

  it('transaction() rolls back on error', async () => {
    const before = await adapter.query<{ id: number }>(
      'SELECT id FROM accounts',
    );
    const beforeCount = before.rows.length;

    await expect(
      adapter.transaction(async (tx) => {
        await tx.execute(
          "INSERT INTO accounts (balance) VALUES (200.0)",
        );
        throw new Error('rollback test');
      }),
    ).rejects.toThrow('rollback test');

    // Verify the insert was rolled back
    const after = await adapter.query<{ id: number }>(
      'SELECT id FROM accounts',
    );
    expect(after.rows.length).toBe(beforeCount);
  });

  it('transaction() propagates the return value', async () => {
    const value = await adapter.transaction(async () => 42);
    expect(value).toBe(42);
  });
});
