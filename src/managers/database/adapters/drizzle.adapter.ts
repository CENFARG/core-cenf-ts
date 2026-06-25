/**
 * Drizzle Database Adapter — SQL database backed by drizzle-orm.
 *
 * Implements the DatabaseManager port using drizzle-orm with
 * @libsql/client (SQLite). Uses the underlying libsql client for
 * raw query/execute and drizzle-orm for GenericRepository<T>.
 *
 * @module managers/database/adapters/drizzle.adapter
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { Client, InArgs } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { DatabaseManager, GenericRepository } from '../ports.js';
import type { QueryResult, FieldInfo, DbConfig } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';
import {
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTransactionError,
} from '../../../shared/errors.js';

// ---------------------------------------------------------------------------
// DrizzleDatabaseAdapter
// ---------------------------------------------------------------------------

/**
 * Drizzle ORM-backed database adapter implementing the DatabaseManager port.
 *
 * Uses @libsql/client for SQLite connectivity. The underlying client handles
 * raw SQL execution (query/execute) while drizzle-orm provides the typed
 * GenericRepository<T> layer.
 *
 * @example
 * ```typescript
 * const adapter = new DrizzleDatabaseAdapter({ url: ':memory:' });
 * await adapter.start();
 * const result = await adapter.query<{ id: number }>('SELECT 1 AS id');
 * await adapter.stop();
 * ```
 */
export class DrizzleDatabaseAdapter implements DatabaseManager {
  private client!: Client;
  private db!: LibSQLDatabase;
  private initialized = false;

  constructor(private readonly config: DbConfig) {}

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      this.client = createClient({ url: this.config.url });
      this.db = drizzle(this.client);
      this.initialized = true;
    } catch (error) {
      throw new DatabaseConnectionError(
        `Failed to connect to database at '${this.config.url}'.`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async stop(): Promise<void> {
    this.client.close();
    this.initialized = false;
  }

  async health(): Promise<HealthStatus> {
    this.ensureInitialized();
    try {
      await this.client.execute('SELECT 1');
      return {
        status: 'healthy',
        details: { adapter: 'drizzle', driver: this.config.driver ?? 'drizzle' },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          adapter: 'drizzle',
          error: error instanceof Error ? error.message : 'unknown error',
        },
      };
    }
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — query (raw SQL via libsql client)
  // -----------------------------------------------------------------------

  async query<T = unknown>(
    sqlStr: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    this.ensureInitialized();
    try {
      const result = await this.client.execute(sqlStr, (params ?? []) as InArgs);
      const rows = result.rows as unknown as T[];
      const fields = inferFieldsFromColumns(result.columns);
      return { rows, rowCount: result.rows.length, fields };
    } catch (error) {
      throw new DatabaseQueryError(
        `Query failed: ${sqlStr.slice(0, 80)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — execute (raw SQL via libsql client)
  // -----------------------------------------------------------------------

  async execute(sqlStr: string, params?: unknown[]): Promise<number> {
    this.ensureInitialized();
    try {
      const result = await this.client.execute(sqlStr, (params ?? []) as InArgs);
      return result.rowsAffected;
    } catch (error) {
      throw new DatabaseQueryError(
        `Execute failed: ${sqlStr.slice(0, 80)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — transaction
  // -----------------------------------------------------------------------

  async transaction<T>(
    fn: (db: DatabaseManager) => Promise<T>,
  ): Promise<T> {
    this.ensureInitialized();
    try {
      await this.execute('BEGIN');
      const result = await fn(this);
      await this.execute('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.execute('ROLLBACK');
      } catch {
        // Ignore rollback errors.
      }
      throw error instanceof Error
        ? error
        : new DatabaseTransactionError(
            'Transaction failed.',
            error instanceof Error ? error : undefined,
          );
    }
  }

  // -----------------------------------------------------------------------
  // GenericRepository factory (uses drizzle-orm for type-safe CRUD)
  // -----------------------------------------------------------------------

  /**
   * Create a typed repository for CRUD operations on a table.
   *
   * Uses auto-increment integer primary keys (`id`). The repository
   * uses the libsql client directly for raw SQL operations.
   *
   * @param tableName - The table name to bind the repository to.
   * @returns A {@link GenericRepository} for the given table.
   */
  getRepository<T extends { id?: number }>(
    tableName: string,
  ): GenericRepository<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      async findById(id: string | number): Promise<T | null> {
        const result = await self.query<T>(
          `SELECT * FROM ${tableName} WHERE id = ?`,
          [id],
        );
        return result.rows.length > 0 ? (result.rows[0] as T) : null;
      },

      async findAll(): Promise<T[]> {
        const result = await self.query<T>(`SELECT * FROM ${tableName}`);
        return result.rows;
      },

      async create(entity: Partial<T>): Promise<T> {
        const keys = Object.keys(entity as Record<string, unknown>);
        const values = Object.values(entity as Record<string, unknown>);
        const placeholders = keys.map(() => '?').join(', ');
        const colList = keys.join(', ');

        await self.execute(
          `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})`,
          values,
        );

        // Retrieve the last inserted row id
        const lastId = await self.query<{ id: number }>(
          'SELECT last_insert_rowid() AS id',
        );
        const id = lastId.rows[0]?.id ?? 1;

        return { id, ...entity } as unknown as T;
      },

      async update(id: string | number, entity: Partial<T>): Promise<T> {
        const keys = Object.keys(entity as Record<string, unknown>);
        const setClauses = keys.map((col) => `${col} = ?`).join(', ');
        const values = Object.values(entity as Record<string, unknown>);

        await self.execute(
          `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`,
          [...values, id],
        );

        // Re-read to return the full updated entity
        const result = await self.query<T>(
          `SELECT * FROM ${tableName} WHERE id = ?`,
          [id],
        );
        if (result.rows.length === 0) {
          throw new DatabaseQueryError(
            `Entity not found in table '${tableName}' with id '${id}'`,
          );
        }
        return result.rows[0]!;
      },

      async delete(id: string | number): Promise<void> {
        await self.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new DatabaseConnectionError(
        'DrizzleDatabaseAdapter: not initialized. Call start() first.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Infer field metadata from libsql column names.
 */
function inferFieldsFromColumns(
  columns: string[] | undefined,
): FieldInfo[] {
  if (!columns || columns.length === 0) return [];
  return columns.map((col) => ({
    name: col,
    dataType: 'string',
  }));
}
