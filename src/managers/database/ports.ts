/**
 * DatabaseManager port interface — SQL query execution with transaction support.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/database/ports
 */

import type { AsyncLifecycle } from '../../shared/lifecycle.js';
import type { QueryResult } from './types.js';

/**
 * Database manager port for SQL query execution and transaction management.
 *
 * Provides `query()` for SELECT, `execute()` for INSERT/UPDATE/DELETE,
 * and `transaction()` for atomic multi-statement operations.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface DatabaseManager extends AsyncLifecycle {
  /**
   * Execute a SELECT query and return typed result rows.
   *
   * Uses parameterized queries to prevent SQL injection.
   *
   * @param sql - The SQL query string with `$1`, `$2`, ... placeholders.
   * @param params - Query parameters in positional order.
   * @returns A {@link QueryResult} containing rows, row count, and field metadata.
   */
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  /**
   * Execute an INSERT, UPDATE, or DELETE statement.
   *
   * Returns the number of affected rows.
   *
   * @param sql - The SQL statement with `$1`, `$2`, ... placeholders.
   * @param params - Statement parameters in positional order.
   * @returns Number of affected rows.
   */
  execute(sql: string, params?: unknown[]): Promise<number>;

  /**
   * Execute a function within an ACID transaction.
   *
   * If the function throws, the transaction is rolled back.
   * If it resolves, the transaction is committed.
   *
   * @param fn - Async function receiving a {@link DatabaseManager} bound to the transaction.
   * @returns The value returned by `fn` on successful commit.
   */
  transaction<T>(fn: (db: DatabaseManager) => Promise<T>): Promise<T>;
}

/**
 * Generic repository interface providing CRUD operations for a typed entity.
 *
 * Builds on top of {@link DatabaseManager} to provide higher-level
 * data access patterns. Each instance is bound to a specific table/entity.
 */
export interface GenericRepository<T> {
  /**
   * Find a single entity by its primary key.
   *
   * @param id - The primary key value.
   * @returns The entity, or `null` if not found.
   */
  findById(id: string | number): Promise<T | null>;

  /**
   * Retrieve all entities from the table.
   *
   * @returns Array of all entities.
   */
  findAll(): Promise<T[]>;

  /**
   * Insert a new entity.
   *
   * @param entity - The entity data (partial — id is auto-generated).
   * @returns The created entity with its generated id.
   */
  create(entity: Partial<T>): Promise<T>;

  /**
   * Update an existing entity by primary key.
   *
   * @param id - The primary key value.
   * @param entity - The partial entity data to update.
   * @returns The updated entity.
   */
  update(id: string | number, entity: Partial<T>): Promise<T>;

  /**
   * Delete an entity by primary key.
   *
   * @param id - The primary key value.
   */
  delete(id: string | number): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const DATABASE_PORT_VERSION = '0.1.0';
