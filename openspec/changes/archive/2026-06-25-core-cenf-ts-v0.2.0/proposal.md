# Proposal: core-cenf-ts v0.2.0 — Production-Ready Adapters

## Intent

core-cenf-ts v0.1.0 ships 19 managers with memory-only adapters — credible for demos but not for production. This change introduces 3 real production adapters (Redis, S3, Drizzle), eliminates the dotenv BSD-2-Clause license risk, fixes OOM integration tests, and adds a blind agent E2E test proving 19-manager composition. Addresses all top 5 concerns from the Perplexity architecture audit.

## Scope

### In Scope
1. **Remove dotenv** → Replace `loadDotenv()` with Node 20.6+ `process.loadEnvFile()`. Remove dotenv from dependencies.
2. **RedisCacheAdapter** → ioredis-based adapter with XFetch stampede protection, key prefix scoping, graceful in-memory fallback.
3. **Blind Agent E2E Test** → Import all 19 managers, dependency-ordered bootstrap, assertions on key methods.
4. **Fix OOM + Split Integration Tests** → Split `bootstrap.integration.test.ts` into 3 files. Use `pool: 'forks'` + `singleFork: true`. Add lightweight `e2e.test.ts` with 5 core managers. Disable coverage for integration tests.
5. **S3StorageAdapter** → @aws-sdk/client-s3 with configurable endpoint (MinIO support), presigned URLs, S3 error classification.
6. **DrizzleDatabaseAdapter** → drizzle-orm v0.45.2 with GenericRepository<T>, SQLite mode for zero-Docker testing, transaction support.
7. **CI/CD Pipeline** → npm audit in CI, Vitest coverage threshold, SBOM generation (CycloneDX).

### Out of Scope
- NatsEventBusAdapter (@nats-io/nats-core v3) — deferred to v0.3.0
- Gemini workflow automation — deferred to v0.3.0
- Monorepo split (@cenf/config, @cenf/redis, etc.) — deferred to v0.3.0
- Docusaurus documentation — deferred to v0.3.0

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `redis-cache-adapter`: Production Redis adapter with ioredis, XFetch stampede protection, key prefix scoping, graceful fallback
- `s3-storage-adapter`: Production S3 adapter with @aws-sdk/client-s3, MinIO support, presigned URLs
- `drizzle-database-adapter`: Production Drizzle adapter with GenericRepository<T>, SQLite mode, transactions
- `ci-cd-pipeline`: npm audit, coverage thresholds, SBOM generation in CI

### Modified Capabilities
- `config-manager`: Remove dotenv dependency, replace with native `process.loadEnvFile()` in EnvConfigAdapter
- `cache-manager`: Add RedisCacheAdapter as production adapter (spec currently references Redis but only has MemoryCacheAdapter)
- `storage-manager`: Add S3StorageAdapter as production adapter (spec currently references S3 but only has MemoryStorageAdapter)
- `database-manager`: Add DrizzleDatabaseAdapter as production adapter (spec currently references Drizzle but only has MemoryDatabaseAdapter)

## Approach

Each adapter follows the existing port/adapter pattern: write test first (TDD), implement adapter, verify against Python sibling patterns. Integration tests split by concern to avoid OOM. CI pipeline added as GitHub Actions workflow.

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Remove dotenv, add @cyclonedx/cyclonedx-npm (devDep) |
| `src/managers/cache/adapters/redis.adapter.ts` | New | ioredis wrapper with XFetch, prefix scoping, fallback |
| `src/managers/storage/adapters/s3.adapter.ts` | New | @aws-sdk/client-s3 wrapper with presigned URLs |
| `src/managers/database/adapters/drizzle.adapter.ts` | New | drizzle-orm wrapper with GenericRepository<T> |
| `src/managers/config/adapters/env.adapter.ts` | Modified | Replace dotenv import with `process.loadEnvFile()` |
| `src/__tests__/bootstrap.integration.test.ts` | Split | Into 3 files: foundation, data, integration |
| `src/__tests__/e2e.test.ts` | New | 5 core managers E2E smoke test |
| `.github/workflows/ci.yml` | New | npm audit, vitest coverage, SBOM generation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ioredis connection failures in tests | Medium | Use memory fallback, skip integration tests without Redis URL |
| Drizzle SQLite vs PostgreSQL API differences | Medium | Test SQLite mode first, document PostgreSQL requirements |
| S3 adapter requires AWS credentials | Low | Use MinIO local endpoint for testing, mock in CI |
| Integration test OOM persists after split | Low | `pool: 'forks'` + `singleFork: true` + disable coverage for integration |
| process.loadEnvFile() not available on Node <20.6 | Low | engines already set to >=20.0.0, bump to >=20.6.0 |

## Rollback Plan

1. Revert all commits on `feature/core-cenf-ts-v0.2.0` branch — no main branch changes until PR merge
2. If dotenv removal breaks existing consumers: restore dotenv as devDependency only, document `--env-file` requirement
3. If real adapters cause test instability: gate integration tests behind `CI_HAS_REDIS`, `CI_HAS_S3`, `CI_HAS_DB` environment flags
4. Bump version back to 0.1.1 if v0.2.0 ships with regressions

## Dependencies

- Node.js >=20.6.0 (for `process.loadEnvFile()`)
- Redis server (optional, for integration tests)
- MinIO or S3-compatible endpoint (optional, for integration tests)
- SQLite (built-in, zero extra dependency for Drizzle testing)

## Success Criteria

- [ ] All 637 existing tests pass (no regressions from v0.1.0)
- [ ] dotenv removed from package.json dependencies, zero BSD-2-Clause licenses in production deps
- [ ] RedisCacheAdapter: 20+ tests, XFetch stampede protection verified, graceful fallback tested
- [ ] S3StorageAdapter: 20+ tests, presigned URL generation verified, MinIO endpoint tested
- [ ] DrizzleDatabaseAdapter: 20+ tests, GenericRepository CRUD verified, transactions tested, SQLite mode works
- [ ] Integration tests: split into 3 files, all pass without OOM on target machine
- [ ] Blind agent E2E test: imports all 19 managers, bootstrap completes, key method assertions pass
- [ ] CI pipeline: npm audit passes, coverage threshold enforced, SBOM generated
- [ ] `npm run test` completes in <60s on target machine
