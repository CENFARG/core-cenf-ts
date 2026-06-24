# DatabaseManager Specification

## Purpose

Provides database connectivity with Drizzle ORM (≥0.45.2), generic repository pattern, and transaction support. Abstracts ORM-specific APIs behind a common interface.

## Port Interface

```typescript
interface IDatabaseManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<DatabaseHealth>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

interface DatabaseHealth {
  connected: boolean;
  latencyMs: number;
  poolStatus?: { active: number; idle: number; waiting: number };
}
```

## Adapter Contracts

| Adapter | Purpose |
|---------|---------|
| `DrizzleDatabaseAdapter` | Wraps Drizzle ORM with PostgreSQL/SQLite drivers |
| `PrismaDatabaseAdapter` | Wraps Prisma Client (alternative) |

## Error Types

- `DatabaseConnectionError` — Cannot connect to database
- `DatabaseQueryError` — SQL execution failed
- `DatabaseTransactionError` — Transaction commit/rollback failed

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CENF_DB_URL` | `string` | `""` | Database connection string |
| `CENF_DB_DRIVER` | `drizzle\|prisma` | `drizzle` | ORM driver |
| `CENF_DB_POOL_SIZE` | `number` | `10` | Connection pool size |
| `CENF_DB_MIGRATIONS_DIR` | `string` | `./migrations` | Migration files path |

## Lifecycle

- `start()`: Connects to database, runs pending migrations, validates pool
- `stop()`: Closes all connections, drains pool
- `health()`: Returns connection status, latency, pool stats

## Testing Strategy

- **Unit**: GenericRepository<T> CRUD operations with memory adapter
- **Integration**: Drizzle adapter with test PostgreSQL container
- **Edge cases**: Connection pool exhaustion, transaction rollback, migration failures

## Requirements

### Requirement: Connection Lifecycle Management

The system MUST manage database connections with connect/disconnect lifecycle. Health checks MUST verify actual connectivity.

#### Scenario: Successful connection

- GIVEN valid `CENF_DB_URL` pointing to a running database
- WHEN `await db.connect()` is called
- THEN the connection pool is established
- AND `await db.health()` returns `{ connected: true, latencyMs: <50 }`

#### Scenario: Connection failure

- GIVEN `CENF_DB_URL` points to an unreachable host
- WHEN `await db.connect()` is called
- THEN it throws `DatabaseConnectionError`
- AND the error includes the connection string (without credentials)

#### Scenario: Graceful disconnect

- GIVEN an active database connection
- WHEN `await db.disconnect()` is called
- THEN all connections are closed
- AND subsequent queries throw `DatabaseConnectionError`

### Requirement: Transaction Support

The system MUST support transactions with automatic rollback on error. The transaction function MUST receive a transaction context.

#### Scenario: Successful transaction commit

- WHEN `await db.transaction(async (tx) => { await tx.execute("INSERT..."); return "ok"; })` is called
- THEN the INSERT is committed
- AND `"ok"` is returned

#### Scenario: Transaction rollback on error

- WHEN the transaction function throws an error mid-execution
- THEN all operations within the transaction are rolled back
- AND the error is propagated to the caller

#### Scenario: Raw SQL query execution

- GIVEN a table `users` exists with columns `id`, `name`
- WHEN `await db.query<User>("SELECT * FROM users WHERE id = $1", [1])` is called
- THEN it returns an array of matching rows typed as `User[]`
- AND SQL injection via params is prevented
