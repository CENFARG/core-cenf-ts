/**
 * @cenf/database — SQL query execution with transaction support.
 *
 * @module @cenf/database
 */

// Port
export { type DatabaseManager, type GenericRepository, DATABASE_PORT_VERSION } from './ports.js';

// Types
export type { QueryResult, FieldInfo, DbConfig } from './types.js';
export { DATABASE_TYPES_VERSION } from './types.js';

// Adapters
export { MemoryDatabaseAdapter } from './adapters/memory.adapter.js';
export { DrizzleDatabaseAdapter } from './adapters/drizzle.adapter.js';
