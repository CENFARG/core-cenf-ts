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
