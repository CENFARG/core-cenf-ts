# Proposal: core-cenf-ts v0.3.0 — Monorepo + Production Adapters

**Change**: core-cenf-ts-v0.3.0
**Date**: 2026-06-25
**Status**: proposed

---

## Intent

Upgrade core-cenf-ts from a monolithic npm package (v0.2.0, 19 managers, 3 real adapters) to a **pnpm monorepo with 25 scoped packages** (`@cenf/*`), with **10 production adapters**, **3 new managers**, and **30 Docusaurus pages**.

This completes the TypeScript port of CENF Core Infrastructure to production-grade parity with core-cenf-py (Python v0.1.0, 21 managers).

---

## Scope

### Phase 1 — Monorepo Foundation
- **pnpm workspaces** + **turborepo** for task orchestration
- Extract `@cenf/core` (shared: errors, types, lifecycle, context, utils)
- Migrate 19 existing managers to individual packages
- Add `@cenf/bootstrap` (lifecycle wiring) and `@cenf/core` as meta-package
- 819 existing tests must pass after migration

### Phase 2 — Production Adapters (7 new/migrated)
| Adapter | Package | External Dep |
|---------|---------|-------------|
| NatsEventBusAdapter (Core + JetStream KV/streams) | `@cenf/event-bus` | `@nats-io/nats-core` |
| OTelAdapter (Tracing spans + Metrics counters/histograms) | `@cenf/observability` | `@opentelemetry/sdk-node` |
| UndiciHttpClientAdapter | `@cenf/http-client` | `undici` |
| OpossumCircuitBreakerAdapter | `@cenf/circuit-breaker` | `opossum` |
| RedisRateLimiterAdapter (distributed token bucket) | `@cenf/rate-limiter` | `ioredis` |
| I18nextAdapter | `@cenf/i18n` | `i18next` |
| UnleashFeatureFlagAdapter | `@cenf/feature-flags` | `unleash-client` |

### Phase 3 — New Managers (3 of 6 deferred)
| Manager | Package | External Dep | Rationale |
|---------|---------|-------------|-----------|
| TaskQueueManager | `@cenf/task-queue` | `bullmq` | Redis-backed, Node-native |
| PermissionManager | `@cenf/permission` | `casbin.js` | RBAC/ABAC, model files |
| LicenceManager | `@cenf/licence` | `jose` | JWT claims, grace period |

**Deferred to v0.4.0**: AlertManager, DynamicPromptingManager, UpdateManager.

### Phase 4 — CI/CD + Documentation
- **changesets** for per-package versioning and CHANGELOG
- npm publish CI workflow (triggered on Version PR merge)
- **Docusaurus** 30 pages (Diátaxis framework)
- npm audit + SBOM per package

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo tooling | pnpm + turbo | Fast installs, workspace protocol |
| Package scope | `@cenf/*` | Professional, avoids name squatting |
| Shared code | `@cenf/core` (single base package) | Errors/types/lifecycle/context/utils are tightly coupled |
| Versioning | Independent per-package (changesets) | Allows targeted releases |
| NATS | Core + JetStream (KV + streams) | Full feature parity with Python NatsBus |
| OTel | Tracing + Metrics | Production observability |
| Deferred managers | Alert, Prompting, Update | Application-level or needs spike |

---

## Package Map (25 packages)

```
@cenf/core            [zero deps]
├── @cenf/config       [zod]
├── @cenf/logging      [pino]
├── @cenf/secret       [zero deps]
├── @cenf/errors       [@cenf/core]
├── @cenf/validation   [zod, @cenf/core]
├── @cenf/observability [@opentelemetry/api, @cenf/core]
├── @cenf/auth         [jose, @cenf/core]
├── @cenf/cache        [ioredis, @cenf/core]
├── @cenf/feature-flags [@cenf/core]
├── @cenf/rate-limiter  [ioredis, @cenf/core]
├── @cenf/database     [drizzle-orm, @cenf/core]
├── @cenf/storage      [@aws-sdk/client-s3, @cenf/core]
├── @cenf/http-client  [undici, @cenf/core]
├── @cenf/circuit-breaker [opossum, @cenf/core]
├── @cenf/event-bus    [@nats-io/nats-core, @cenf/core]
├── @cenf/i18n         [i18next, @cenf/core]
├── @cenf/json-serializer [@cenf/core]
├── @cenf/health       [@cenf/core]
├── @cenf/task-queue   [bullmq, @cenf/core]  ← NEW
├── @cenf/permission   [casbin, @cenf/core]  ← NEW
├── @cenf/licence      [jose, @cenf/core]    ← NEW
└── @cenf/bootstrap    [all managers]
```

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `@cenf` scope registration on npm | BLOCKER | Manual prerequisite |
| Import path breakage during migration | HIGH | Incremental extraction per package |
| sdd-propose sub-agent unavailable (API credits) | HIGH | Orchestrator writes inline |
| Monorepo tooling complexity | MEDIUM | Start with 3 packages, expand |
| JetStream semantics differ from Python NatsBus | MEDIUM | Narrow port surface, test heavily |
| Docusaurus generation volume | MEDIUM | Batch 10 pages per iteration |

---

## Delivery Plan (11 slices, 4 chained PRs)

| # | Slice | Est. Lines |
|---|-------|-----------|
| 1 | pnpm workspace + turbo + @cenf/core | ~200 |
| 2 | 5 zero-dep managers | ~400 |
| 3 | 4 light-dep managers | ~400 |
| 4 | 5 heavy managers | ~500 ⚠️ |
| 5 | 3 async managers | ~400 |
| 6 | @cenf/bootstrap + core re-exports | ~200 |
| 7 | OTel + Undici + Nats adapters | ~600 ⚠️ |
| 8 | Opossum + RedisRL + I18next + Unleash | ~400 |
| 9 | task-queue + permission + licence | ~500 ⚠️ |
| 10 | CI/changesets/npm publish | ~200 |
| 11 | Docusaurus 30 pages | ~800 ⚠️ |

⚠️ = chained PR recommended (>400 lines)
