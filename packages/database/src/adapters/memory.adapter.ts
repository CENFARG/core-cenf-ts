/**
 * In-memory database adapter — Map-based tables for testing.
 *
 * Implements the DatabaseManager port with no external dependencies.
 * Stores data in `Map<string, Record<string, unknown>[]>` where each key
 * is a table name. Supports basic INSERT, SELECT, UPDATE, DELETE with
 * a lightweight SQL parser and in-memory transactions via snapshot isolation.
 *
 * @module managers/database/adapters/memory.adapter
 */

import type { DatabaseManager, GenericRepository } from '../ports.js';
import type { QueryResult, FieldInfo } from '../types.js';
import type { HealthStatus } from '@cenf/core';
import { DatabaseQueryError } from '@cenf/core';

/** A table row stored in memory. */
type Row = Record<string, unknown>;

/** Snapshot of table state for transaction rollback. */
interface TableSnapshot {
  table: string;
  rows: Row[];
}

/**
 * In-memory database adapter backed by a native `Map`.
 *
 * Each table is stored as an array of `Record<string, unknown>` rows.
 * Supports parameterized SQL with `$1, $2, ...` placeholders for
 * safe query construction. Transactions use snapshot isolation:
 * on failure, all table state is restored to the pre-transaction snapshot.
 *
 * Use this adapter:
 * - In unit tests where a real database is not available
 * - For prototyping and rapid iteration
 * - As a reference implementation for the DatabaseManager port
 */
export class MemoryDatabaseAdapter implements DatabaseManager {
  /** Table store: table name → array of row objects. */
  private tables = new Map<string, Row[]>();

  /** Auto-increment counter for primary key generation. */
  private nextId = 1;

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.tables.clear();
    this.nextId = 1;
  }

  async stop(): Promise<void> {
    this.tables.clear();
    this.nextId = 1;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        tableCount: this.tables.size,
        tableNames: Array.from(this.tables.keys()),
      },
    };
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — query
  // -----------------------------------------------------------------------

  async query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const { table, where } = this.parseSql(sql, params);
    const rows = this.getTable(table);

    let filtered: Row[];
    if (where) {
      filtered = rows.filter((row) => row[where.column] === where.value);
    } else {
      filtered = [...rows];
    }

    const fields: FieldInfo[] =
      filtered.length > 0
        ? Object.keys(filtered[0]!).map((name) => ({
            name,
            dataType: typeof filtered[0]![name] === 'number' ? 'INTEGER' : 'TEXT',
          }))
        : this.inferFields(table);

    return {
      rows: filtered as T[],
      rowCount: filtered.length,
      fields,
    };
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — execute
  // -----------------------------------------------------------------------

  async execute(sql: string, params?: unknown[]): Promise<number> {
    const upper = sql.trim().toUpperCase();

    if (upper.startsWith('INSERT')) {
      return this.handleInsert(sql, params);
    }
    if (upper.startsWith('DELETE')) {
      return this.handleDelete(sql, params);
    }
    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(sql, params);
    }

    // Unknown statement type — no-op
    return 0;
  }

  // -----------------------------------------------------------------------
  // DatabaseManager — transaction
  // -----------------------------------------------------------------------

  async transaction<T>(
    fn: (db: DatabaseManager) => Promise<T>,
  ): Promise<T> {
    // Snapshot all current table state for rollback.
    const snapshots: TableSnapshot[] = [];
    for (const [table, rows] of this.tables) {
      snapshots.push({ table, rows: [...rows] });
    }

    try {
      const result = await fn(this);
      return result;
    } catch (error) {
      // Rollback: restore all tables to pre-transaction state.
      for (const snap of snapshots) {
        this.tables.set(snap.table, snap.rows);
      }
      // Clean up any new tables created during the failed transaction.
      for (const table of this.tables.keys()) {
        if (!snapshots.some((s) => s.table === table)) {
          this.tables.delete(table);
        }
      }
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // GenericRepository factory
  // -----------------------------------------------------------------------

  /**
   * Create a typed repository for CRUD operations on a table.
   *
   * The repository uses auto-increment integer primary keys (`id`).
   *
   * @param tableName - The table name to bind the repository to.
   * @returns A {@link GenericRepository} for the given table.
   */
  getRepository<T extends { id?: number }>(
    tableName: string,
  ): GenericRepository<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;

    return {
      async findById(id: string | number): Promise<T | null> {
        const result = await db.query<T>(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [String(id)],
        );
        return result.rows.length > 0 ? (result.rows[0] as T) : null;
      },

      async findAll(): Promise<T[]> {
        const result = await db.query<T>(`SELECT * FROM ${tableName}`);
        return result.rows;
      },

      async create(entity: Partial<T>): Promise<T> {
        const id = db.nextId++;
        const columns = ['id', ...Object.keys(entity as Record<string, unknown>)];
        const values = [String(id), ...Object.values(entity as Record<string, unknown>)];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const colList = columns.join(', ');

        await db.execute(
          `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})`,
          values,
        );

        return { id, ...entity } as unknown as T;
      },

      async update(
        id: string | number,
        entity: Partial<T>,
      ): Promise<T> {
        const existing = await this.findById(id);
        if (!existing) {
          throw new DatabaseQueryError(
            `Entity not found in table '${tableName}' with id '${id}'`,
          );
        }

        const setClauses = Object.keys(entity as Record<string, unknown>)
          .map((col, i) => `${col} = $${i + 1}`)
          .join(', ');
        const values = [
          ...Object.values(entity as Record<string, unknown>),
          String(id),
        ];

        await db.execute(
          `UPDATE ${tableName} SET ${setClauses} WHERE id = $${values.length}`,
          values,
        );

        // Re-read to return the full updated entity
        const result = await db.query<T>(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [String(id)],
        );
        return result.rows[0]!;
      },

      async delete(id: string | number): Promise<void> {
        await db.execute(`DELETE FROM ${tableName} WHERE id = $1`, [String(id)]);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private: INSERT handling
  // -----------------------------------------------------------------------

  private handleInsert(sql: string, params?: unknown[]): number {
    const match = sql.match(
      /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
    );
    if (!match) return 0;

    const table = match[1]!;
    const cols = match[2]!.split(',').map((c) => c.trim());
    const vals = match[3]!.split(',').map((v) => v.trim());

    // Resolve values: parameters ($1, $2, ...) or literal strings
    const resolved = vals.map((v) => {
      const paramMatch = v.match(/^\$(\d+)$/);
      if (paramMatch && params) {
        const idx = parseInt(paramMatch[1]!, 10) - 1;
        return params[idx];
      }
      // Strip surrounding quotes
      return v.replace(/^'/, '').replace(/'$/, '');
    });

    const row: Row = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]!] = resolved[i];
    }

    this.getTable(table).push(row);
    return 1;
  }

  // -----------------------------------------------------------------------
  // Private: DELETE handling
  // -----------------------------------------------------------------------

  private handleDelete(sql: string, params?: unknown[]): number {
    const { table, where } = this.parseSql(sql, params);
    const rows = this.getTable(table);

    if (!where) {
      const count = rows.length;
      this.tables.set(table, []);
      return count;
    }

    const before = rows.length;
    const filtered = rows.filter((row) => row[where.column] !== where.value);
    this.tables.set(table, filtered);
    return before - filtered.length;
  }

  // -----------------------------------------------------------------------
  // Private: UPDATE handling
  // -----------------------------------------------------------------------

  private handleUpdate(sql: string, params?: unknown[]): number {
    // Try with WHERE clause first (non-greedy .+? stops at required WHERE)
    let match = sql.match(
      /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i,
    );
    if (!match) {
      // No WHERE clause — greedy .+ consumes the rest
      match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+)/i);
    }
    if (!match) return 0;

    const table = match[1]!;
    const setClause = match[2]!;
    const whereClause = match[3] ?? null;

    // Parse SET clause: "col1 = $1, col2 = $2"
    const setPairs = setClause.split(',').map((p) => {
      const [col, val] = p.split('=').map((s) => s.trim());
      const paramMatch = val!.match(/^\$(\d+)$/);
      if (paramMatch && params) {
        const idx = parseInt(paramMatch[1]!, 10) - 1;
        return { col: col!, value: params[idx] };
      }
      return { col: col!, value: val!.replace(/^'/, '').replace(/'$/, '') };
    });

    let count = 0;
    const rows = this.getTable(table);

    for (const row of rows) {
      const matches =
        !whereClause || this.rowMatchesWhere(row, whereClause, params);
      if (matches) {
        for (const { col, value } of setPairs) {
          row[col] = value;
        }
        count++;
      }
    }

    return count;
  }

  // -----------------------------------------------------------------------
  // Private: SQL parsing helpers
  // -----------------------------------------------------------------------

  /**
   * Parse a basic SQL statement to extract the table name and WHERE clause.
   */
  private parseSql(
    sql: string,
    params?: unknown[],
  ): { table: string; where: { column: string; value: unknown } | null } {
    // Match: SELECT ... FROM <table> [WHERE <col> = <val>]
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*(.+?)(?:\s|$)/i);

    let where: { column: string; value: unknown } | null = null;

    if (whereMatch) {
      const col = whereMatch[1]!;
      let val: unknown = whereMatch[2]!.trim();

      const paramMatch = (val as string).match(/^\$(\d+)$/);
      if (paramMatch && params) {
        const idx = parseInt(paramMatch[1]!, 10) - 1;
        val = params[idx];
      } else {
        val = (val as string).replace(/^'/, '').replace(/'$/, '');
      }

      where = { column: col, value: val };
    }

    return {
      table: fromMatch ? fromMatch[1]! : 'unknown',
      where,
    };
  }

  /**
   * Check if a row matches a WHERE clause expression.
   */
  private rowMatchesWhere(
    row: Row,
    whereClause: string,
    params?: unknown[],
  ): boolean {
    const match = whereClause.match(/(\w+)\s*=\s*(.+?)(?:\s|$)/i);
    if (!match) return false;

    const col = match[1]!;
    let val: unknown = match[2]!.trim();

    const paramMatch = (val as string).match(/^\$(\d+)$/);
    if (paramMatch && params) {
      const idx = parseInt(paramMatch[1]!, 10) - 1;
      val = params[idx];
    } else {
      val = (val as string).replace(/^'/, '').replace(/'$/, '');
    }

    return row[col] === val;
  }

  /**
   * Try to infer field metadata from existing table data.
   */
  private inferFields(table: string): FieldInfo[] {
    const rows = this.tables.get(table);
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]!).map((name) => ({
      name,
      dataType: typeof rows[0]![name] === 'number' ? 'INTEGER' : 'TEXT',
    }));
  }

  /**
   * Get or create a table array.
   */
  private getTable(name: string): Row[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }
}
