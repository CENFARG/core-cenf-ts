# core-cenf-ts v0.2.0 — Master Specification

## Purpose

Aggregate specification for the v0.2.0 release: production-ready adapters replacing all memory-only implementations from v0.1.0. Addresses 5 top concerns from the Perplexity architecture audit: dotenv license risk, no real adapters, supply chain security, Node baseline, and test infrastructure OOM.

## Change Summary

| Capability | Type | Domain | Requirements | Scenarios |
|------------|------|--------|-------------|-----------|
| config-manager (dotenv removal) | MODIFIED | Config | 2 | 6 |
| redis-cache-adapter | NEW | Cache | 5 | 8 |
| s3-storage-adapter | NEW | Storage | 5 | 9 |
| drizzle-database-adapter | NEW | Database | 5 | 10 |
| integration-test-split | NEW | Testing | 3 | 6 |
| blind-agent-e2e | NEW | Testing | 4 | 6 |
| ci-cd-pipeline | NEW | CI/CD | 3 | 4 |

## Total Coverage
- **Requirements**: 27 (2 modified, 25 new)
- **Scenarios**: 49 total
- **Happy paths**: All covered
- **Edge cases**: Connection failures, fallbacks, timeouts, idempotency
- **Error states**: All error types mapped per adapter

## Error Types Affected
| Error Type | Domain | Change |
|-----------|--------|--------|
| `ConfigValidationError` | Config | No change |
| `ConfigNotFoundError` | Config | No change |
| `CacheConnectionError` | Cache | Redis-specific |
| `CacheOperationError` | Cache | Redis-specific |
| `StorageUploadError` | Storage | S3-specific mapping |
| `StorageDownloadError` | Storage | S3-specific mapping |
| `StorageDeleteError` | Storage | No change |
| `StoragePresignError` | Storage | NEW |
| `DatabaseConnectionError` | Database | Drizzle-specific |
| `DatabaseQueryError` | Database | Drizzle-specific |
| `DatabaseTransactionError` | Database | NEW |

## Configuration Changes
| Key | Previous | v0.2.0 | Domain |
|-----|----------|--------|--------|
| `dotenv` dependency | Production dep | REMOVED | Config |
| `engines.node` | `>=20.0.0` | `>=20.6.0` | Config |
| `CENF_CACHE_KEY_PREFIX` | N/A | `core-cenf:cache` | Cache |
| `CENF_STORAGE_ENDPOINT` | N/A | Custom S3 URL | Storage |
| `CENF_DB_DRIVER` | `drizzle\|prisma` | `postgresql\|sqlite` | Database |
| `CENF_DB_SQLITE_PATH` | N/A | `:memory:` | Database |

## Dependencies Added
- `ioredis` — Redis client
- `@aws-sdk/client-s3` — S3 SDK
- `drizzle-orm` v0.45.2 — ORM
- `@libsql/client` or `better-sqlite3` — SQLite driver
- `@cyclonedx/cyclonedx-npm` (dev) — SBOM generation

## Dependencies Removed
- `dotenv` — Replaced by `process.loadEnvFile()`

## Success Criteria
- All 637 existing tests pass (no regressions)
- Zero BSD-2-Clause licenses in production deps
- Integration tests split into 3 files, no OOM
- Blind agent E2E test passes with 19 managers
- CI pipeline: npm audit, coverage >=80%, SBOM generated
- `npm run test` completes in <60s on target machine
