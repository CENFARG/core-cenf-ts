# core-cenf-ts v0.1.0 — Master Specification Index

## Overview

Specification index for all 19 managers in core-cenf-ts v0.1.0, the TypeScript port of core-cenf-py. Provides infrastructure managers following Clean Architecture / Ports & Adapters pattern.

## Architecture Contracts (All Managers)

| Contract | Rule |
|----------|------|
| Port/Adapter | Interface in `ports/*.port.ts`, adapters in `adapters/*.adapter.ts` |
| DI Pattern | Manual constructor injection, NO tsyringe/awilix/reflect-metadata |
| Context | `AsyncLocalStorage<ContextStore>` for correlation/tenant propagation |
| Errors | Every method documents thrown error types; CenfError hierarchy |
| Lifecycle | Every manager implements `AsyncLifecycle { start(), stop(), health() }` |
| Testing | Memory adapter required for every manager with external dependency |
| TDD | Tests written BEFORE implementation; vitest + @vitest/coverage-v8 |

## Manager Specifications

### Foundation (0 dependencies)

| # | Manager | Spec Path | Key Pattern |
|---|---------|-----------|-------------|
| 1 | ConfigManager | `config-manager/spec.md` | Zod schema validation, dotenv loading |
| 2 | LogManager | `log-manager/spec.md` | pino structured logging, child loggers |
| 3 | SecretManager | `secret-manager/spec.md` | env/vault/memory adapters |
| 4 | ErrorHandlingManager | `error-handling-manager/spec.md` | CenfError taxonomy, classify/handle |
| 5 | ValidationManager | `validation-manager/spec.md` | Zod boundary validation |
| 6 | ObservabilityManager | `observability-manager/spec.md` | OTel spans, metrics, context |

### Mid-Level (depend on foundation)

| # | Manager | Spec Path | Key Pattern |
|---|---------|-----------|-------------|
| 7 | AuthManager | `auth-manager/spec.md` | jose JWT, HS256/RS256, JWKS |
| 8 | CacheManager | `cache-manager/spec.md` | ioredis, XFetch stampede protection |
| 9 | FeatureFlagManager | `feature-flag-manager/spec.md` | YAML flags, percentage rollout |
| 10 | RateLimiterManager | `rate-limiter-manager/spec.md` | Token bucket, zero deps |
| 11 | DatabaseManager | `database-manager/spec.md` | Drizzle ORM ≥0.45.2, transactions |
| 12 | StorageManager | `storage-manager/spec.md` | S3/local, streaming uploads |

### Integration (depend on mid-level + http)

| # | Manager | Spec Path | Key Pattern |
|---|---------|-----------|-------------|
| 13 | HttpClientManager | `http-client-manager/spec.md` | undici, retry/backoff, interceptors |
| 14 | CircuitBreakerManager | `circuit-breaker-manager/spec.md` | opossum, state machine, fallback |
| 15 | EventBusManager | `event-bus-manager/spec.md` | @nats-io/nats-core v3, CloudEvents |
| 16 | I18nManager | `i18n-manager/spec.md` | i18next, YAML resources, interpolation |

### Cross-Cutting (depend on everything)

| # | Manager | Spec Path | Key Pattern |
|---|---------|-----------|-------------|
| 17 | JsonSerializer | `json-serializer/spec.md` | BigInt-safe, Date handling |
| 18 | HealthManager | `health-manager/spec.md` | Aggregated checks, readiness/liveness |
| 19 | BootstrapOrchestrator | `bootstrap-orchestrator/spec.md` | Priority ordering, lifecycle wiring |

## Dependency Graph

```
Config → Logger → Secret → ErrorHandling → Observability → Validation
  ↓         ↓         ↓          ↓              ↓              ↓
Auth ← Cache ← FeatureFlag ← RateLimiter ← Database ← Storage
  ↓         ↓         ↓          ↓              ↓              ↓
HttpClient → CircuitBreaker → EventBus → I18n → JsonSerializer → Health → Bootstrap
```

## Out of Scope (v0.2.0+)

TaskQueueManager, DynamicPromptingManager, AlertManager, LicenceManager, UpdateManager, PermissionManager
