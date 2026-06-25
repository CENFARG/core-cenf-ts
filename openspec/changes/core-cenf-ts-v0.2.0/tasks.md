# Tasks: core-cenf-ts v0.2.0 — Production-Ready Adapters

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,250 (300 + 450 + 200 + 300) |
| 400-line budget risk | **High** — PR #2 exceeds budget at ~450 lines |
| Chained PRs recommended | **Yes** — forced by orchestrator |
| Suggested split | PR #1 → PR #2 → PR #3 → PR #4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Decision needed before apply? | No — pre-resolved by orchestrator |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | dotenv removal + RedisCacheAdapter (300 lines) | PR #1 | Base: `feature/core-cenf-ts-v0.2.0` |
| 2 | S3StorageAdapter + DrizzleDatabaseAdapter (~450 lines) | PR #2 | Base: PR #1 branch; **exceeds 400-line budget** |
| 3 | Integration test split + vitest config (200 lines) | PR #3 | Base: PR #2 branch |
| 4 | Blind agent E2E + CI/CD pipeline (300 lines) | PR #4 | Base: PR #3 branch; targets `feature/core-cenf-ts-v0.2.0` |

---

## PR #1 — dotenv Removal + RedisCacheAdapter (~300 lines)

### TASK_001: ✅ Write test — verify process.loadEnvFile() in EnvConfigAdapter
- **PR**: #1
- **Files**: `src/managers/config/adapters/__tests__/env.adapter.test.ts` (modify)
- **Tests**: Update existing test: assert `process.loadEnvFile()` is called, no `dotenv` import
- **Depends on**: none
- **Estimated lines**: +25
- **Acceptance**: Test fails (RED) — `process.loadEnvFile()` not yet wired

### TASK_002: ✅ Replace dotenv import with process.loadEnvFile() in EnvConfigAdapter
- **PR**: #1
- **Files**: `src/managers/config/adapters/env.adapter.ts` (modify)
- **Tests**: `env.adapter.test.ts` — all pass
- **Depends on**: TASK_001
- **Estimated lines**: +10/-10
- **Acceptance**: Zero `dotenv` imports in `src/`; `process.loadEnvFile()` invoked in `start()`

### TASK_003: ✅ Remove dotenv from package.json + bump engines to >=20.6.0
- **PR**: #1
- **Files**: `package.json` (modify)
- **Tests**: `npm run typecheck` — no unresolved `dotenv` references
- **Depends on**: TASK_002
- **Estimated lines**: +2/-2
- **Acceptance**: `dotenv` absent from `dependencies`; `engines.node >= "20.6.0"`

### TASK_004: ✅ Run npm install + verify no dotenv residue
- **PR**: #1
- **Files**: `package-lock.json` (auto-updated)
- **Tests**: `npm test` — all 637 existing tests pass
- **Depends on**: TASK_003
- **Estimated lines**: auto
- **Acceptance**: `npm ls dotenv` returns empty; `npm test` exit 0

### TASK_005: ✅ Write RedisCacheAdapter test — connection + health (RED)
- **PR**: #1
- **Files**: `src/managers/cache/adapters/__tests__/redis.adapter.test.ts` (create)
- **Tests**: Mock ioredis: test successful connect, health returns `{connected: true}`, connection failure → fallback
- **Depends on**: TASK_004
- **Estimated lines**: +80
- **Acceptance**: 8 tests fail (RED) — adapter doesn't exist yet

### TASK_006: ✅ RedisCacheAdapter — connection management (start/stop/health) (GREEN)
- **PR**: #1
- **Files**: `src/managers/cache/adapters/redis.adapter.ts` (create)
- **Tests**: TASK_005 tests pass
- **Depends on**: TASK_005
- **Estimated lines**: +60
- **Acceptance**: `start()` connects ioredis; `health()` returns `{connected, latencyMs}`; `stop()` disconnects; connection failure activates memory fallback

### TASK_007: ✅ Write RedisCacheAdapter test — get/set/del/has/clear + TTL (RED)
- **PR**: #1
- **Files**: `src/managers/cache/adapters/__tests__/redis.adapter.test.ts` (modify)
- **Tests**: set+get, TTL expiry, default TTL, del, has true/false, clear, key prefix scoping
- **Depends on**: TASK_006
- **Estimated lines**: +60
- **Acceptance**: 7 additional tests fail (RED)

### TASK_008: ✅ RedisCacheAdapter — get/set/del/has/clear with TTL + prefix (GREEN)
- **PR**: #1
- **Files**: `src/managers/cache/adapters/redis.adapter.ts` (modify)
- **Tests**: TASK_007 tests pass
- **Depends on**: TASK_007
- **Estimated lines**: +50
- **Acceptance**: All CRUD operations work; key prefix applied; default TTL honored; JSON serialization handles objects/arrays/primitives

### TASK_009: ✅ RedisCacheAdapter — getOrSet with single-flight (XFetch)
- **PR**: #1
- **Files**: `src/managers/cache/adapters/redis.adapter.ts` (modify); `__tests__/redis.adapter.test.ts` (modify)
- **Tests**: 10 concurrent callers → factory called exactly once; cached key → factory not called; grace period recompute
- **Depends on**: TASK_008
- **Estimated lines**: +30 test, +30 impl = 60
- **Acceptance**: Single-flight deduplication verified; `getOrSet` stores result in cache on miss

### TASK_010: ✅ Barrel exports + verify all tests pass
- **PR**: #1
- **Files**: `src/index.ts` (modify); `src/managers/cache/adapters/index.ts` (modify)
- **Tests**: `npm test` — full suite green
- **Depends on**: TASK_009
- **Estimated lines**: +10
- **Acceptance**: `RedisCacheAdapter` exported from barrel; `RedisCacheOptions` exported; `npm test` exit 0; 637+ tests pass

---

## PR #2 — S3StorageAdapter + DrizzleDatabaseAdapter (~450 lines) ⚠️ EXCEEDS 400

### TASK_011: Promote drizzle-orm to deps + add better-sqlite3 devDeps
- **PR**: #2
- **Files**: `package.json` (modify)
- **Tests**: `npm run typecheck`
- **Depends on**: PR #1 merged
- **Estimated lines**: +3/-1
- **Acceptance**: `drizzle-orm` in `dependencies`; `better-sqlite3` + `@types/better-sqlite3` in `devDependencies`

### TASK_012: Write S3StorageAdapter test — connection, put, get, delete (RED)
- **PR**: #2
- **Files**: `src/managers/storage/adapters/__tests__/s3.adapter.test.ts` (create)
- **Tests**: Mock @aws-sdk/client-s3: connect, bucket validation, upload Buffer, upload stream, download, download missing → error, delete idempotent, exists
- **Depends on**: TASK_011
- **Estimated lines**: +100
- **Acceptance**: 10 tests fail (RED) — adapter doesn't exist yet

### TASK_013: S3StorageAdapter — put/get/delete/list/exists (GREEN)
- **PR**: #2
- **Files**: `src/managers/storage/adapters/s3.adapter.ts` (create)
- **Tests**: TASK_012 tests pass
- **Depends on**: TASK_012
- **Estimated lines**: +80
- **Acceptance**: PutObject/GetObject/DeleteObject/ListObjectsV2/HeadObject work; delete idempotent; MinIO endpoint with `forcePathStyle: true`

### TASK_014: Write S3StorageAdapter test — presigned URLs + error mapping (RED)
- **PR**: #2
- **Files**: `src/managers/storage/adapters/__tests__/s3.adapter.test.ts` (modify)
- **Tests**: presignUrl default expiry (3600s), custom expiry, NoSuchKey → StorageDownloadError, AccessDenied → StorageUploadError, network error → StorageDownloadError
- **Depends on**: TASK_013
- **Estimated lines**: +50
- **Acceptance**: 5 additional tests fail (RED)

### TASK_015: S3StorageAdapter — presigned URL generation + S3 error mapping (GREEN)
- **PR**: #2
- **Files**: `src/managers/storage/adapters/s3.adapter.ts` (modify); `src/shared/errors.ts` (modify — add StoragePresignError)
- **Tests**: TASK_014 tests pass
- **Depends on**: TASK_014
- **Estimated lines**: +40
- **Acceptance**: Presigned GET URLs generated with correct expiry; S3 errors mapped to CenfError subtypes with key name in message

### TASK_016: Write DrizzleDatabaseAdapter test — connection, query, health (RED)
- **PR**: #2
- **Files**: `src/managers/database/adapters/__tests__/drizzle.adapter.test.ts` (create)
- **Tests**: SQLite :memory: connect, PostgreSQL pool connect, connection failure → DatabaseConnectionError, health with latency, parameterized query, empty query result
- **Depends on**: TASK_011
- **Estimated lines**: +80
- **Acceptance**: 7 tests fail (RED)

### TASK_017: DrizzleDatabaseAdapter — connection + raw query (GREEN)
- **PR**: #2
- **Files**: `src/managers/database/adapters/drizzle.adapter.ts` (create)
- **Tests**: TASK_016 tests pass
- **Depends on**: TASK_016
- **Estimated lines**: +60
- **Acceptance**: SQLite :memory: works; PostgreSQL pool with configurable size; parameterized SQL safe; health returns latency

### TASK_018: Write DrizzleDatabaseAdapter test — GenericRepository CRUD (RED)
- **PR**: #2
- **Files**: `src/managers/database/adapters/__tests__/drizzle.adapter.test.ts` (modify)
- **Tests**: create → returns entity with id, findById, findAll with filter, update, delete → idempotent, type-safe return types
- **Depends on**: TASK_017
- **Estimated lines**: +60
- **Acceptance**: 6 additional tests fail (RED)

### TASK_019: DrizzleDatabaseAdapter — GenericRepository<T> (CRUD) + transactions (GREEN)
- **PR**: #2
- **Files**: `src/managers/database/adapters/drizzle.adapter.ts` (modify)
- **Tests**: TASK_018 tests pass; add transaction tests: commit, rollback on error, isolation
- **Depends on**: TASK_018
- **Estimated lines**: +80
- **Acceptance**: Full CRUD with typed returns; transaction commit; automatic rollback on error; migration placeholder logs warning

### TASK_020: Barrel exports + npm install + full regression
- **PR**: #2
- **Files**: `src/index.ts` (modify); `package-lock.json` (auto)
- **Tests**: `npm test` — full suite
- **Depends on**: TASK_015, TASK_019
- **Estimated lines**: +10
- **Acceptance**: S3StorageAdapter, DrizzleDatabaseAdapter, StoragePresignError exported; `npm test` exit 0

---

## PR #3 — Integration Test Split (~200 lines)

### TASK_021: Configure vitest for pool isolation + integration project
- **PR**: #3
- **Files**: `vitest.config.ts` (modify)
- **Tests**: Verify `pool: 'forks'`, `singleFork: true`, coverage disabled for integration, 30s timeout
- **Depends on**: PR #2 merged
- **Estimated lines**: +20
- **Acceptance**: `npx vitest run --project integration` uses forked processes

### TASK_022: Write bootstrap-core.test.ts — foundation managers (RED)
- **PR**: #3
- **Files**: `tests/integration/bootstrap-core.test.ts` (create)
- **Tests**: Config, Logging, Secret, Error, Validation — 5 managers bootstrap with memory adapters; assert key methods
- **Depends on**: TASK_021
- **Estimated lines**: +60
- **Acceptance**: 5 manager tests fail (RED) — file doesn't exist yet; runs independently with `npx vitest run bootstrap-core.test.ts`

### TASK_023: Write bootstrap-infra.test.ts — infrastructure managers
- **PR**: #3
- **Files**: `tests/integration/bootstrap-infra.test.ts` (create)
- **Tests**: Cache, Database, Storage, HttpClient, CircuitBreaker — 5 managers with memory adapters; gated by env vars for real adapters
- **Depends on**: TASK_021
- **Estimated lines**: +60
- **Acceptance**: 5 manager tests; skips real-adapter tests when `CI_HAS_*` env vars absent

### TASK_024: Write bootstrap-full.test.ts — orchestration managers
- **PR**: #3
- **Files**: `tests/integration/bootstrap-full.test.ts` (create)
- **Tests**: EventBus, I18n, JsonSerializer, Health, Bootstrap — 5+ managers; aggregate health
- **Depends on**: TASK_021
- **Estimated lines**: +50
- **Acceptance**: Bootstrap orchestrator starts all managers; health aggregates correctly

### TASK_025: Write e2e.test.ts — 5-manager lightweight smoke test
- **PR**: #3
- **Files**: `tests/e2e/e2e.test.ts` (create)
- **Tests**: Config.load, Logging.info, Cache.set/get, Database.query, Storage.upload/download — all memory adapters; <10s runtime
- **Depends on**: TASK_022, TASK_023, TASK_024
- **Estimated lines**: +40
- **Acceptance**: Test completes <10s; all 5 managers boot; key method assertions pass; excluded from integration project

---

## PR #4 — Blind Agent E2E + CI/CD Pipeline (~300 lines)

### TASK_026: Write blind_agent_demo.test.ts — 19-manager import + bootstrap (RED)
- **PR**: #4
- **Files**: `examples/blind_agent_demo.test.ts` (create)
- **Tests**: Import all 19 manager types from barrel; dependency-ordered bootstrap; each start() resolves; orchestrator reports healthy
- **Depends on**: PR #3 merged
- **Estimated lines**: +60
- **Acceptance**: Test fails (RED) — file doesn't exist; passes with zero external services

### TASK_027: Blind agent — assertions per manager (GREEN)
- **PR**: #4
- **Files**: `examples/blind_agent_demo.test.ts` (modify)
- **Tests**: config.load(), logging.info(), cache.set/get, db.query(), storage.upload(), httpClient.get(), circuitBreaker.execute(), eventBus.publish(), i18n.t(), serializer.serialize(), health.check()
- **Depends on**: TASK_026
- **Estimated lines**: +50
- **Acceptance**: ≥1 assertion per manager; health aggregates all 19; orchestrator stop() runs reverse order

### TASK_028: Run blind agent test with clean environment
- **PR**: #4
- **Files**: (none new)
- **Tests**: `npx vitest run blind_agent_demo.test.ts` — passes with only `CENF_ENV=test`
- **Depends on**: TASK_027
- **Estimated lines**: +0
- **Acceptance**: Zero external dependencies required; default env vars sufficient; no ConfigNotFoundError

### TASK_029: Write .github/workflows/ci.yml — full CI pipeline (RED)
- **PR**: #4
- **Files**: `.github/workflows/ci.yml` (create)
- **Tests**: npm ci → typecheck → lint → test → audit --audit-level=high → coverage → SBOM
- **Depends on**: TASK_028
- **Estimated lines**: +50
- **Acceptance**: CI file exists; `act` or manual push triggers workflow

### TASK_030: Configure vitest coverage threshold 80%
- **PR**: #4
- **Files**: `vitest.config.ts` (modify)
- **Tests**: `npx vitest run --coverage` exits non-zero below 80% branch coverage; lcov.info generated
- **Depends on**: TASK_029
- **Estimated lines**: +10
- **Acceptance**: Coverage threshold enforced; CI fails below 80%

### TASK_031: SBOM generation with CycloneDX
- **PR**: #4
- **Files**: `package.json` (modify — add @cyclonedx/cyclonedx-npm devDep); `package-lock.json` (auto)
- **Tests**: `npx cyclonedx-npm --output-file sbom.json` produces valid CycloneDX 1.4 JSON; includes all production deps; artifact uploaded in CI
- **Depends on**: TASK_029
- **Estimated lines**: +5
- **Acceptance**: SBOM valid; CI uploads as artifact; `npm run test` full regression passes

---

## Summary

| Phase | Tasks | Lines | PR |
|-------|-------|-------|-----|
| dotenv Removal | TASK_001–004 | ~40 | #1 |
| RedisCacheAdapter | TASK_005–010 | ~260 | #1 |
| **PR #1 subtotal** | **10** | **~300** | |
| Package deps | TASK_011 | ~5 | #2 |
| S3StorageAdapter | TASK_012–015 | ~270 | #2 |
| DrizzleDatabaseAdapter | TASK_016–020 | ~175 | #2 |
| **PR #2 subtotal** | **10** | **~450** ⚠️ | |
| Vitest config | TASK_021 | ~20 | #3 |
| Integration split | TASK_022–025 | ~210 | #3 |
| **PR #3 subtotal** | **5** | **~230** | |
| Blind agent | TASK_026–028 | ~110 | #4 |
| CI/CD pipeline | TASK_029–031 | ~65 | #4 |
| **PR #4 subtotal** | **6** | **~175** | |
| **TOTAL** | **31** | **~1,155** | |

### Implementation Order

1. **PR #1** (Tasks 001–010): Dotenv removal + RedisCacheAdapter. Foundation work — no downstream deps. Targets `feature/core-cenf-ts-v0.2.0`.
2. **PR #2** (Tasks 011–020): S3StorageAdapter + DrizzleDatabaseAdapter. Targets PR #1 branch. ⚠️ Exceeds 400-line budget — orchestrator should consider splitting S3 (012-015) and Drizzle (016-020) into separate slices if reviewers flag.
3. **PR #3** (Tasks 021–025): Integration test split + vitest config. Targets PR #2 branch. Pure test refactor — no production code change.
4. **PR #4** (Tasks 026–031): Blind agent E2E + CI pipeline. Targets PR #3 branch. Proves full composition; CI enforces quality gates.

### Next Step

`sdd-apply` — start PR #1 (Tasks 001–010). All decisions pre-resolved; chain strategy is feature-branch-chain; no user questions pending.
