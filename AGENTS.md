# CENF Core Infrastructure — TypeScript (core-cenf-ts)

> **Agent entry point**: This file is the primary entry point for AI agents working on this project.
> Read this first, then consult `AGENTS_API.md` for the manager catalog.

## Overview

core-cenf-ts is a TypeScript port of [core-cenf-py](https://github.com/CENFARG/core-cenf-py) (v0.1.0),
providing 15 transversal infrastructure managers following **Clean Architecture / Hexagonal (Ports & Adapters)**.

## Architecture Principle

> Depend on Protocols, inject Adapters. Never import adapters in business logic.

```typescript
// ✅ CORRECT — depend on port (interface)
import type { CacheManager } from './ports/cache-manager.port.js';

// ❌ WRONG — avoid direct adapter imports in business logic
import { RedisCacheAdapter } from '../infrastructure/cache/redis-cache.adapter.js';
```

## 15 Managers

| # | Manager       | Port                               | Adapter Ecosystem          | Python Sibling |
|---|---------------|------------------------------------|----------------------------|----------------|
| 1 | Config        | `ConfigManager`                    | Typed env/Zod schema       | ConfigManager  |
| 2 | Logging       | `LogManager`                       | pino                       | LogManager     |
| 3 | Validation    | `ValidationManager`                | Zod                        | ValidationMgr  |
| 4 | Cache         | `CacheManager`                     | ioredis                    | CacheManager   |
| 5 | Database      | `DatabaseManager`                  | Drizzle or Prisma          | DatabaseMgr    |
| 6 | Auth          | `AuthManager`                      | jose (JWT)                 | AuthManager    |
| 7 | Observability | `ObservabilityManager`             | @opentelemetry/api         | Observability  |
| 8 | Storage       | `StorageManager`                   | @aws-sdk/client-s3         | StorageManager |
| 9 | CircuitBreaker| `CircuitBreakerManager`            | opossum                    | CircuitBreaker |
| 10| I18n          | `I18nManager`                      | i18next                    | I18nManager    |
| 11| EventBus      | `EventBusManager`                  | nats                       | EventBus       |
| 12| HttpClient    | `HttpClientManager`                | Native fetch + retry       | HttpClient     |
| 13| Bootstrap     | `BootstrapOrchestrator`            | Lifecycle wiring           | BootstrapOrch  |
| 14| Health        | `HealthManager`                    | Aggregated health checks   | HealthManager  |
| 15| JsonSerializer| `JsonSerializer`                   | Native BigInt-safe JSON    | JsonSerializer |

## File Structure (planned)

```
src/
├── index.ts                           # Public API exports
├── managers/
│   ├── config/
│   │   ├── ports.ts                   # IConfigManager interface
│   │   ├── adapters/                  # Implementations
│   │   │   ├── env-config.adapter.ts
│   │   │   └── zod-config.adapter.ts
│   │   ├── errors.ts
│   │   └── types.ts
│   ├── logging/
│   ├── cache/
│   ├── database/
│   ├── auth/
│   ├── observability/
│   ├── storage/
│   ├── circuit-breaker/
│   ├── i18n/
│   ├── event-bus/
│   ├── http-client/
│   ├── bootstrap/
│   ├── health/
│   └── json-serializer/
├── shared/
│   ├── errors.ts                      # Base error classes
│   ├── types.ts                       # Shared types
│   └── utils.ts                       # Shared utilities
└── infrastructure/                    # Cross-cutting adapters
    └── ...
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
npm test
```

## References

- `AGENTS_API.md` — Structured catalog of all 15 managers
- `api-catalog.json` — Machine-parseable API reference
- `openspec/config.yaml` — SDD project configuration
- CodeGraph: TODO (build when code exists)
