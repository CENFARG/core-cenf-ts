# Design: core-cenf-ts v0.2.0 — Production-Ready Adapters

## Technical Approach

Upgrade v0.1.0 from memory-only adapters to production-ready infrastructure: replace `dotenv` with native `process.loadEnvFile()`, add Redis/S3/Drizzle adapters, split OOM integration tests, and introduce a blind-agent E2E test plus CI pipeline. Every adapter follows the existing port/adapter pattern and reuses the `CenfError` hierarchy.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| dotenv removal | `process.loadEnvFile()` (Node ≥20.6.0) | Keep dotenv as devDep | Eliminates BSD-2-Clause license risk; native since Node 20.6.0. engines bumped to `>=20.6.0`. |
| Cache single-flight | In-process `Map<string, Promise>` | Redis RedLock | Simpler, zero extra deps, covers 99% stampede cases. Redis locks add latency/complexity for same outcome. |
| Cache fallback | MemoryCacheAdapter on Redis error | Return null / throw | Graceful degradation per spec; maintains service continuity. |
| S3 presigned URL | Adapter-specific `presignUrl()` method | Extend `StorageManager` port | Existing port is stable; adding to port forces all adapters. Consumer can cast or use S3 type when needed. |
| Drizzle test backend | `better-sqlite3` (sync, in-memory) | PostgreSQL in Docker | Zero Docker, instant tests, same drizzle-orm API surface. |
| drizzle-orm placement | Move to `dependencies` | Keep as `peerDependencies` | ORM is required at runtime; consumers shouldn't install it separately. |
| Integration test split | 3 files + `pool: 'forks'` | Single file with less coverage | Fixes OOM on target machine; isolates concerns. |
| Blind agent test | Memory adapters only, barrel import | Real adapters | Must pass with zero external services; proves composition. |
| CI pipeline | GitHub Actions, `npm audit --audit-level=high` | No audit / manual checks | Automated supply-chain security; enforces coverage ≥80%. |

## Data Flow

```
Config (EnvConfigAdapter)
  └─→ process.loadEnvFile() ──→ process.env

Cache (RedisCacheAdapter)
  ├─→ ioredis ──→ Redis
  └─→ fallback ──→ MemoryCacheAdapter

Storage (S3StorageAdapter)
  └─→ @aws-sdk/client-s3 ──→ S3 / MinIO

Database (DrizzleDatabaseAdapter)
  ├─→ drizzle-orm + pg ──→ PostgreSQL
  └─→ drizzle-orm + better-sqlite3 ──→ SQLite (:memory:)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/managers/config/adapters/env.adapter.ts` | Modify | Replace `dotenv` import with `process.loadEnvFile()`; remove `dotenvPath`/`override` options |
| `src/managers/cache/adapters/redis.adapter.ts` | Create | ioredis wrapper with XFetch, key prefix, graceful fallback |
| `src/managers/storage/adapters/s3.adapter.ts` | Create | S3 client wrapper; implements `StorageManager` port; adds `presignUrl()` |
| `src/managers/database/adapters/drizzle.adapter.ts` | Create | drizzle-orm wrapper with `GenericRepository<T>`, SQLite/PostgreSQL drivers |
| `src/shared/errors.ts` | Modify | Add `StoragePresignError` |
| `src/index.ts` | Modify | Export new adapters and `StoragePresignError` |
| `package.json` | Modify | Remove `dotenv`; move `drizzle-orm` to deps; add `better-sqlite3` + `@types/better-sqlite3` devDeps; add `@cyclonedx/cyclonedx-npm` devDep; bump engines to `>=20.6.0` |
| `vitest.config.ts` | Modify | Add `pool: 'forks'`, `singleFork: true`, integration project with coverage disabled |
| `src/managers/bootstrap/__tests__/bootstrap.integration.test.ts` | Delete | Replaced by split files |
| `tests/integration/bootstrap-core.test.ts` | Create | Config, Logger, Secret, Error, Validation |
| `tests/integration/bootstrap-infra.test.ts` | Create | Cache, Database, Storage, HttpClient, CircuitBreaker |
| `tests/integration/bootstrap-full.test.ts` | Create | EventBus, I18n, JsonSerializer, Health, Bootstrap (10 managers) |
| `tests/e2e/e2e.test.ts` | Create | 5-manager smoke test with memory adapters |
| `examples/blind_agent_demo.test.ts` | Create | 19-manager dependency-ordered bootstrap with key method assertions |
| `.github/workflows/ci.yml` | Create | npm ci → typecheck → lint → test → audit → coverage → SBOM |

## Interfaces / Contracts

### RedisCacheAdapter
```typescript
export interface RedisCacheOptions {
  url: string;
  keyPrefix?: string;
  defaultTtlMs?: number;
  stampedeWindowMs?: number;
}

export class RedisCacheAdapter implements CacheManager {
  constructor(options: RedisCacheOptions);
  async start(): Promise<void>;
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T>;
  async del(key: string): Promise<void>;
  async has(key: string): Promise<boolean>;
  async clear(): Promise<void>;
  async health(): Promise<HealthStatus>;
}
```

### S3StorageAdapter
```typescript
export interface S3StorageOptions {
  region: string;
  bucket: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

export class S3StorageAdapter implements StorageManager {
  constructor(options: S3StorageOptions);
  async start(): Promise<void>;
  async put(key: string, data: Buffer | string, metadata?: StorageMetadata): Promise<void>;
  async get(key: string): Promise<StorageObject | null>;
  async delete(key: string): Promise<void>;
  async list(prefix?: string): Promise<StorageObject[]>;
  async exists(key: string): Promise<boolean>;
  async presignUrl(key: string, expiresIn?: number): Promise<string>;
}
```

### DrizzleDatabaseAdapter
```typescript
export interface DrizzleDbOptions {
  driver: 'postgresql' | 'sqlite';
  url?: string;
  sqlitePath?: string;
  poolSize?: number;
}

export class DrizzleDatabaseAdapter implements DatabaseManager {
  constructor(options: DrizzleDbOptions);
  async start(): Promise<void>;
  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  async execute(sql: string, params?: unknown[]): Promise<number>;
  async transaction<T>(fn: (db: DatabaseManager) => Promise<T>): Promise<T>;
  getRepository<T extends { id?: number }>(tableName: string): GenericRepository<T>;
  async health(): Promise<HealthStatus>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | RedisCacheAdapter, S3StorageAdapter, DrizzleDatabaseAdapter | Mock ioredis / S3Client / drizzle-orm; assert error mapping, single-flight, repository CRUD |
| Integration | 3 split bootstrap files | Memory + real adapters (Redis/S3/DB) when env vars present; skip when absent |
| E2E | `e2e.test.ts` (5 managers) | Memory adapters only; <10s runtime |
| Blind Agent | `blind_agent_demo.test.ts` | Barrel import, dependency-ordered bootstrap, 1+ assertion per manager |
| CI | Full suite | `npm test`, `npm run typecheck`, `npm run lint`, `npm audit --audit-level=high`, coverage ≥80%, SBOM artifact |

## Migration / Rollout

- **Node version**: Bump `engines.node` to `>=20.6.0`. Consumers on <20.6 must upgrade.
- **dotenv consumers**: If external users relied on `dotenvPath` option in `EnvConfigAdapter`, they must switch to `--env-file` CLI flag or call `process.loadEnvFile()` manually before bootstrap.
- **drizzle-orm**: Moved from `devDependencies` to `dependencies` — consumers will now install it automatically.
- **Feature flags**: Integration tests gated by `CI_HAS_REDIS`, `CI_HAS_S3`, `CI_HAS_DB` env vars; skip with `test.skip()` when absent.

## Open Questions

- [ ] Should `StorageManager` port be extended with `presignUrl()` in v0.3.0, or kept adapter-specific?
- [ ] Should `DrizzleDatabaseAdapter` support `libsql` (Turso) in addition to `better-sqlite3`?
- [ ] Is `examples/blind_agent_demo.test.ts` the right location, or should it be under `tests/e2e/`?
