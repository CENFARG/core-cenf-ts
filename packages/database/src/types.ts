/**
 * DatabaseManager-specific types.
 *
 * Types for query results, database configuration, and field metadata.
 *
 * @module managers/database/types
 */

// ---------------------------------------------------------------------------
// QueryResult — typed rows with metadata
// ---------------------------------------------------------------------------

/**
 * Result of a database query containing typed rows and metadata.
 *
 * @typeParam T - The shape of each row in the result set.
 */
export interface QueryResult<T = unknown> {
  /** The result rows, each typed as `T`. */
  rows: T[];

  /** Number of rows returned (for SELECT) or affected (for INSERT/UPDATE/DELETE). */
  rowCount: number;

  /** Column metadata for the result set. */
  fields: FieldInfo[];
}

/**
 * Metadata for a single column in a query result.
 */
export interface FieldInfo {
  /** Column name. */
  name: string;

  /** SQL data type string (e.g., `TEXT`, `INTEGER`, `BOOLEAN`). */
  dataType: string;
}

// ---------------------------------------------------------------------------
// DbConfig — database connection configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for database connectivity.
 *
 * Used by database adapters to establish connection pools
 * and configure driver-specific behavior.
 */
export interface DbConfig {
  /** Database connection string (e.g., `postgres://user:pass@host:5432/db`). */
  url: string;

  /** Maximum number of connections in the pool. Default: 10. */
  poolSize?: number;

  /** ORM driver to use. Default: `drizzle`. */
  driver?: 'drizzle' | 'prisma';

  /** Directory containing migration files. Default: `./migrations`. */
  migrationsDir?: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const DATABASE_TYPES_VERSION = '0.1.0';
