import { describe, it, expect } from 'vitest';
import {
  DATABASE_PORT_VERSION,
  type DatabaseManager,
} from '../ports.js';
import type { QueryResult, DbConfig } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Test implementation of DatabaseManager + GenericRepository for contract
// ---------------------------------------------------------------------------

class TestDatabaseManager implements DatabaseManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async query<T = unknown>(
    _sql: string,
    _params?: unknown[],
  ): Promise<QueryResult<T>> {
    return { rows: [], rowCount: 0, fields: [] };
  }

  async execute(_sql: string, _params?: unknown[]): Promise<number> {
    return 0;
  }

  async transaction<T>(
    fn: (db: DatabaseManager) => Promise<T>,
  ): Promise<T> {
    return fn(this);
  }
}

// ---------------------------------------------------------------------------
// DatabaseManager port contract tests
// ---------------------------------------------------------------------------

describe('DatabaseManager port', () => {
  it('exports a runtime version constant', () => {
    expect(DATABASE_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: DatabaseManager = new TestDatabaseManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestDatabaseManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('query() returns empty QueryResult by default', async () => {
    const mgr = new TestDatabaseManager();
    const result = await mgr.query<{ id: number }>('SELECT * FROM users');
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('execute() returns zero affected rows by default', async () => {
    const mgr = new TestDatabaseManager();
    const affected = await mgr.execute('DELETE FROM users WHERE id = $1', [1]);
    expect(affected).toBe(0);
  });

  it('transaction() passes through function result', async () => {
    const mgr = new TestDatabaseManager();
    const result = await mgr.transaction(async (db) => {
      expect(db).toBeDefined();
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  it('transaction() propagates error', async () => {
    const mgr = new TestDatabaseManager();
    await expect(
      mgr.transaction(async () => {
        throw new Error('tx-fail');
      }),
    ).rejects.toThrow('tx-fail');
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestDatabaseManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Database types tests
// ---------------------------------------------------------------------------

describe('Database types', () => {
  it('QueryResult has rows, rowCount, and fields', () => {
    const result: QueryResult<{ name: string }> = {
      rows: [{ name: 'test' }],
      rowCount: 1,
      fields: [{ name: 'name', dataType: 'TEXT' }],
    };
    expect(result.rows).toHaveLength(1);
    expect(result.rowCount).toBe(1);
    expect(result.fields[0].name).toBe('name');
  });

  it('DbConfig has connection parameters', () => {
    const cfg: DbConfig = {
      url: 'postgres://localhost:5432/test',
      poolSize: 10,
      driver: 'drizzle',
    };
    expect(cfg.url).toContain('postgres');
    expect(cfg.poolSize).toBe(10);
  });

  it('GenericRepository<T> implements CRUD contract', () => {
    const repo: GenericRepository<{ id: number; name: string }> = {
      findById: async (_id) => null,
      findAll: async () => [],
      create: async (_entity) => ({ id: 1, name: 'created' }),
      update: async (_id, _entity) => ({ id: 1, name: 'updated' }),
      delete: async (_id) => {},
    };
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findAll).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
    expect(repo.delete).toBeInstanceOf(Function);
  });
});
