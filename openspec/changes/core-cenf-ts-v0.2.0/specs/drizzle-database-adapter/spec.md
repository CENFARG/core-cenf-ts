# DrizzleDatabaseAdapter Specification

## Purpose

Production database adapter using drizzle-orm v0.45.2, providing GenericRepository<T> pattern, SQLite backend for zero-Docker testing, and transaction support.

## Port Interface

```typescript
interface IDatabaseManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<DatabaseHealth>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

interface GenericRepository<T> {
  findById(id: string | number): Promise<T | undefined>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<boolean>;
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `DrizzleDatabaseAdapter` | drizzle-orm wrapper with PostgreSQL/SQLite drivers |
| `MemoryDatabaseAdapter` | In-memory store for unit testing |

## Error Types

- `DatabaseConnectionError` — Cannot connect to database
- `DatabaseQueryError` — SQL execution failed
- `DatabaseTransactionError` — Transaction commit/rollback failed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_DB_URL` | `string` | `""` | Database connection string |
| `CENF_DB_DRIVER` | `postgresql\|sqlite` | `postgresql` | Backend driver |
| `CENF_DB_SQLITE_PATH` | `string` | `:memory:` | SQLite file path (sqlite mode) |
| `CENF_DB_POOL_SIZE` | `number` | `10` | Connection pool size (PostgreSQL only) |
| `CENF_DB_MIGRATIONS_DIR` | `string` | `./migrations` | Migration files path |

## Requirements

### Requirement: Database Connection with Driver Selection

The system MUST connect using the configured driver (PostgreSQL or SQLite). SQLite mode MUST work with `:memory:` for zero-Docker testing. PostgreSQL mode MUST use a connection pool.

#### Scenario: SQLite in-memory connection

- GIVEN `CENF_DB_DRIVER=sqlite` and `CENF_DB_SQLITE_PATH=:memory:`
- WHEN `await adapter.connect()` is called
- THEN an in-memory SQLite database is created via drizzle-orm
- AND `await adapter.health()` returns `{ connected: true, latencyMs: <10 }`

#### Scenario: PostgreSQL connection with pool

- GIVEN `CENF_DB_URL=postgres://user:pass@localhost:5432/db` and `CENF_DB_POOL_SIZE=5`
- WHEN `await adapter.connect()` is called
- THEN a connection pool of 5 is established
- AND `await adapter.health()` returns pool status with active/idle counts

#### Scenario: Connection failure with invalid URL

- GIVEN `CENF_DB_URL=postgres://invalid:5432/db` pointing to unreachable host
- WHEN `await adapter.connect()` is called
- THEN it throws `DatabaseConnectionError`
- AND the error includes the sanitized URL (credentials redacted)

### Requirement: GenericRepository CRUD Operations

The system MUST provide a `GenericRepository<T>` that supports findById, findAll, create, update, and delete. The repository MUST be type-safe — no `any` returns.

#### Scenario: Create and find entity

- GIVEN a `users` table with schema `{ id, name, email }`
- WHEN `await repo.create({ name: "Alice", email: "alice@test.com" })` is called
- THEN a new row is inserted with an auto-generated `id`
- AND `await repo.findById(id)` returns the created entity

#### Scenario: Find all with filter

- GIVEN 3 users exist: Alice, Bob, Charlie
- WHEN `await repo.findAll({ name: "Alice" })` is called
- THEN it returns only Alice's record
- AND the result is typed as `User[]`

#### Scenario: Update existing entity

- GIVEN a user exists with `name: "Alice"`
- WHEN `await repo.update(id, { name: "Alice Updated" })` is called
- THEN the row is updated in the database
- AND the returned entity reflects the new name

#### Scenario: Delete entity

- GIVEN a user exists with a known `id`
- WHEN `await repo.delete(id)` is called
- THEN the row is removed from the database
- AND subsequent `findById(id)` returns `undefined`

### Requirement: Transaction Support with Automatic Rollback

The system MUST support transactions via drizzle-orm's transaction API. Errors within a transaction MUST trigger automatic rollback. Nested transactions MUST be supported.

#### Scenario: Successful transaction commit

- WHEN `await db.transaction(async (tx) => { await tx.insert(users).values(...); return "ok"; })` is called
- THEN the INSERT is committed to the database
- AND `"ok"` is returned to the caller

#### Scenario: Transaction rollback on error

- WHEN the transaction function throws after an INSERT but before completion
- THEN all operations within the transaction are rolled back
- AND the error propagates to the caller
- AND no partial data remains in the database

#### Scenario: Transaction isolation

- GIVEN two concurrent transactions modifying the same row
- WHEN both execute simultaneously
- THEN one completes and the other waits or fails based on isolation level
- AND no data corruption occurs

### Requirement: Raw SQL Query Execution

The system MUST execute raw SQL queries with parameterized inputs. Results MUST be typed. SQL injection via params MUST be prevented.

#### Scenario: Parameterized query

- GIVEN a `users` table exists with data
- WHEN `await db.query<User>("SELECT * FROM users WHERE id = $1", [1])` is called
- THEN it returns matching rows typed as `User[]`
- AND params are bound safely (no string interpolation)

#### Scenario: Query with no results

- GIVEN no users match the filter criteria
- WHEN a query is executed
- THEN it returns an empty array `[]`
- AND no error is thrown

### Requirement: Migration Support Placeholder

The system MUST provide a migration runner interface. The v0.2.0 implementation MUST include a placeholder that logs "migrations not yet implemented" without failing.

#### Scenario: Migration runner placeholder

- WHEN `await adapter.runMigrations()` is called
- THEN it logs a warning at INFO level
- AND returns without throwing
- AND the message indicates migrations are deferred to a future version

#### Scenario: Migration directory configuration

- GIVEN `CENF_DB_MIGRATIONS_DIR=./migrations` is set
- WHEN the adapter initializes
- THEN the migration directory path is stored for future use
- AND no migration files are scanned in v0.2.0
