# CENF Core Infrastructure — TypeScript (core-cenf-ts)

> **Agent entry point**: This file is the primary entry point for AI agents working on this project.
> Read this first, then consult `AGENTS_API.md` for the manager catalog.

## Overview

core-cenf-ts is a TypeScript port of [core-cenf-py](https://github.com/CENFARG/core-cenf-py) (v0.1.0),
providing **19 transversal infrastructure managers** following **Clean Architecture / Hexagonal (Ports & Adapters)**.

**Latest release**: [v0.2.0](https://github.com/CENFARG/core-cenf-ts/releases/tag/v0.2.0) — Production-ready with 3 real adapters (Redis, S3, Drizzle), dotenv eliminated, blind agent E2E, CI/CD pipeline. 708 tests, all passing.

## Architecture Principle

> Depend on Protocols, inject Adapters. Never import adapters in business logic.

```typescript
// ✅ CORRECT — depend on port (interface)
import type { CacheManager } from './ports/cache-manager.port.js';

// ❌ WRONG — avoid direct adapter imports in business logic
import { RedisCacheAdapter } from '../infrastructure/cache/redis-cache.adapter.js';
```

## 19 Managers

| # | Manager       | Port                               | Adapter Ecosystem          | Python Sibling |
|---|---------------|------------------------------------|----------------------------|----------------|
| 1 | Config        | `ConfigManager`                    | Typed env/Zod schema       | ConfigManager  |
| 2 | Logging       | `LogManager`                       | pino                       | LogManager     |
| 3 | Secret        | `SecretManager`                    | env/vault/memory           | *(new)*        |
| 4 | ErrorHandling | `ErrorHandlingManager`             | @handle_errors decorator   | *(new)*        |
| 5 | Validation    | `ValidationManager`                | Zod                        | ValidationMgr  |
| 6 | Observability | `ObservabilityManager`             | @opentelemetry/api         | Observability  |
| 7 | Auth          | `AuthManager`                      | jose (JWT)                 | AuthManager    |
| 8 | Cache         | `CacheManager`                     | ioredis                    | CacheManager   |
| 9 | FeatureFlag   | `FeatureFlagManager`               | YAML/memory                | *(new)*        |
| 10| RateLimiter   | `RateLimiterManager`               | Token bucket (zero deps)   | *(new)*        |
| 11| Database      | `DatabaseManager`                  | Drizzle or Prisma          | DatabaseMgr    |
| 12| Storage       | `StorageManager`                   | @aws-sdk/client-s3         | StorageManager |
| 13| HttpClient    | `HttpClientManager`                | undici + retry             | HttpClient     |
| 14| CircuitBreaker| `CircuitBreakerManager`            | opossum                    | CircuitBreaker |
| 15| EventBus      | `EventBusManager`                  | @nats-io/nats-core v3      | EventBus       |
| 16| I18n          | `I18nManager`                      | i18next                    | I18nManager    |
| 17| JsonSerializer| `JsonSerializer`                   | Native BigInt-safe JSON    | JsonSerializer |
| 18| Health        | `HealthManager`                    | Aggregated health checks   | HealthManager  |
| 19| Bootstrap     | `BootstrapOrchestrator`            | Lifecycle wiring           | BootstrapOrch  |

## File Structure

```
src/
├── index.ts                           # Public API exports
├── managers/
│   ├── config/
│   ├── logging/
│   ├── secret/
│   ├── error-handling/
│   ├── validation/
│   ├── observability/
│   ├── auth/
│   ├── cache/
│   ├── feature-flag/
│   ├── rate-limiter/
│   ├── database/
│   ├── storage/
│   ├── http-client/
│   ├── circuit-breaker/
│   ├── event-bus/
│   ├── i18n/
│   ├── json-serializer/
│   ├── health/
│   └── bootstrap/
├── shared/
│   ├── errors.ts                      # CenfError hierarchy
│   ├── types.ts                       # Shared types
│   ├── context.ts                     # AsyncLocalStorage wrapper
│   └── lifecycle.ts                   # AsyncLifecycle interface
```

## @ai-directive (agent instructions)

- **TDD strict**: Write test first. Always.
- **Port/Adapter**: Every manager starts with a port interface. Adapters implement the port.
- **Clean Architecture**: Domain logic never depends on infrastructure details.
- **Testing**: vitest, unit + integration + e2e via supertest.
- **Commits**: Work-unit commits per SDD convention. Chained PRs for changes over 400 lines.
- **Python sibling**: Use `core-cenf-py` (v0.1.0) as reference for patterns, error types, and method signatures. Adapt, don't copy — TypeScript idioms differ.

## Installation

```bash
git clone https://github.com/CENFARG/core-cenf-ts.git
cd core-cenf-ts
pnpm install
pnpm build
```

## Context Propagation (IMPLICIT)

```typescript
import { context } from './src/shared/context.js';
context.run({ correlationId: 'req-123', tenantId: 'cntrs' }, async () => {
  // All downstream calls inherit context via AsyncLocalStorage
});
```

**Rule**: NEVER pass context as function arguments. Always use AsyncLocalStorage.

## Error Taxonomy

```typescript
import { TransientError, PermanentError, ValidationError, AuthError, RateLimitError } from './src/shared/errors.js';
// TransientError: retryable (network, deadlock)
// PermanentError: not retryable (missing resource, invalid config)
```

## Testing Patterns

```typescript
// Use in-memory adapters for unit tests
import { MemoryCacheAdapter } from '@cenf/cache';
const cache = new MemoryCacheAdapter();

// Use vitest
import { describe, it, expect } from 'vitest';
describe('CacheManager', () => {
  it('returns cached value', async () => {
    const val = await cache.getOrSet('key', async () => 'value', 60);
    expect(val).toBe('value');
  });
});
```

## Commit Gate (MANDATORY)

```bash
pnpm typecheck          # ZERO errors
pnpm lint               # ZERO errors
pnpm test               # ALL green (708 tests)
```

## CI/CD Pipeline

Every push runs:
1. **Lint + TypeCheck + Test** (ESLint, tsc, vitest)
2. **Security Scan** (Trivy)
3. **SBOM Generation** (CycloneDX)

Pipeline: `.github/workflows/ci.yml`

## @ai-directive by Manager

| Manager | @ai-directive |
|---------|--------------|
| ConfigManager | Never access `process.env` directly. Use `config.get()`. |
| LogManager | Use pino child loggers. Mask credentials before logging. |
| SecretManager | Secrets are never logged. Auto-masked `.toString()`. |
| ErrorHandlingManager | `@handleErrors()` never swallows — always re-raises. |
| CacheManager | Cache miss is NOT an error. Use stampede protection. |
| DatabaseManager | Always use transactions. Never raw sessions. |
| StorageManager | Never infer MIME type from extension. |
| HttpClientManager | Circuit breaker protects by host. Timeouts mandatory. |
| EventBusManager | `publish()` is fire-and-forget. Exact-match subscriptions. |
| RateLimiterManager | Use `isAllowed()` before any rate-limited operation. |
| BootstrapOrchestrator | `startup()` → `waitForSignal()` → `shutdown()`. Strict order. |

## Anti-Patterns

| ❌ Wrong | ✅ Right |
|----------|---------|
| Import adapter directly | Import port (interface) |
| `process.env.DB_HOST` | `config.get('db.host')` |
| Pass context as args | AsyncLocalStorage (implicit) |
| Log raw secrets | Auto-masked `.toString()` |
| Skip commit gate | Always `typecheck + lint + test` |

## Quick Start

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

## References

- `AGENTS_API.md` — Structured catalog of all 19 managers
- `api-catalog.json` — Machine-parseable API reference
- `openspec/config.yaml` — SDD project configuration
- CodeGraph: `.codegraph/` — Pre-indexed knowledge graph (auto-synced)
- LLM-optimized index: `llms.txt`
