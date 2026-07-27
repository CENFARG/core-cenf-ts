# Tasks: core-cenf-ts v0.3.0 — Monorepo Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,600 across 11 slices |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 4 chained PRs (foundation → adapters → new managers → docs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: workspace + 19 manager packages | PR 1 | base=main; ~1,500 lines |
| 2 | Production adapters (7) | PR 2 | base=PR 1 branch; ~1,000 lines |
| 3 | New managers (task-queue, permission, licence) | PR 3 | base=PR 2 branch; ~500 lines |
| 4 | CI/CD + Docusaurus | PR 4 | base=PR 3 branch; ~1,000 lines |

## Phase 1: Foundation (Slices 1–6)

- [ ] 1.1 Scaffold `pnpm-workspace.yaml`, `turbo.json`, root `package.json` (private:true)
- [ ] 1.2 Create `packages/core/` extracting errors/types/lifecycle/context/utils from `src/shared/`
- [ ] 1.3 Add `tsup.config.ts` per package; turbo orchestrates build/test/lint/typecheck
- [ ] 1.4 Configure `workspace:*` protocol in all package.jsons; verify `pnpm install` (R1.1–R1.5)
- [ ] 1.5 Extract `@cenf/secret` (zero deps); existing tests pass (R2.1)
- [ ] 1.6 Extract `@cenf/rate-limiter` (zero deps); tests pass
- [ ] 1.7 Extract `@cenf/feature-flag` (YAML/memory); tests pass
- [ ] 1.8 Extract `@cenf/json-serializer` (BigInt-safe); tests pass
- [ ] 1.9 Extract `@cenf/health` (aggregated checks); tests pass
- [ ] 1.10 Extract `@cenf/config` (zod); tests pass
- [ ] 1.11 Extract `@cenf/logging` (pino); tests pass
- [ ] 1.12 Extract `@cenf/validation` (zod); tests pass
- [ ] 1.13 Extract `@cenf/error-handling` + create `@cenf/errors` package
- [ ] 1.14 Extract `@cenf/auth` (jose JWT); tests pass
- [ ] 1.15 Extract `@cenf/cache` (ioredis); tests pass
- [ ] 1.16 Extract `@cenf/database` (drizzle-orm); tests pass
- [ ] 1.17 Extract `@cenf/storage` (@aws-sdk/client-s3); tests pass
- [ ] 1.18 Extract `@cenf/observability` (@opentelemetry/api); tests pass
- [ ] 1.19 Extract `@cenf/http-client` (undici); tests pass
- [ ] 1.20 Extract `@cenf/circuit-breaker` (opossum); tests pass
- [ ] 1.21 Extract `@cenf/event-bus` (@nats-io/nats-core v3); tests pass
- [ ] 1.22 Extract `@cenf/i18n` (i18next); tests pass
- [ ] 1.23 Extract `@cenf/bootstrap` (lifecycle wiring via constructor injection)
- [ ] 1.24 Update `@cenf/core` barrel with all 19 port re-exports (R2.3)
- [ ] 1.25 Delete monolithic `src/`; `turbo run build test`; 819 tests pass; tag v0.3.0-alpha.1 (R2.2, R2.4)

## Phase 2: Production Adapters (Slices 7–8)

- [ ] 2.1 Spike: confirm `@nats-io/nats-core` v3 JetStream KV API parity with Python NatsBus
- [ ] 2.2 Add `NatsEventBusAdapter` to `@cenf/event-bus` (Core + JetStream KV/streams, R3.1–R3.6)
- [ ] 2.3 Add `OTelAdapter` to `@cenf/observability` (Tracing + Metrics + OTLP/Console, R4.1–R4.5)
- [ ] 2.4 Add `UndiciHttpClientAdapter` to `@cenf/http-client` (retry/timeout/interceptors, R5.1)
- [ ] 2.5 Add `OpossumCircuitBreakerAdapter` to `@cenf/circuit-breaker` (CLOSED→OPEN→HALF_OPEN, R5.2)
- [ ] 2.6 Add `RedisRateLimiterAdapter` (Lua scripts) to `@cenf/rate-limiter` (R5.3)
- [ ] 2.7 Add `I18nextAdapter` to `@cenf/i18n` (locale/interpolation/pluralization, R5.4)
- [ ] 2.8 Add `UnleashFeatureFlagAdapter` to `@cenf/feature-flag` (server-side + gradual rollout, R5.5)
- [ ] 2.9 Update AGENTS_API.md + api-catalog.json with all 10 adapters
- [ ] 2.10 Integration tests: NATS docker-compose + OTel collector; all scenarios pass

## Phase 3: New Managers (Slice 9)

- [ ] 3.1 Create `@cenf/task-queue` (bullmq): add/process/retry/DLQ/cron (R6.1–R6.2)
- [ ] 3.2 Create `@cenf/permission` (casbin.js): enforce() + RBAC/ABAC model files (R6.3–R6.4)
- [ ] 3.3 Create `@cenf/licence` (jose): sign/verify/checkGrace with grace period (R6.5)
- [ ] 3.4 Wire new managers in `@cenf/bootstrap`; update `@cenf/core` re-exports; full suite passes

## Phase 4: CI/CD + Docusaurus (Slices 10–11)

- [ ] 4.1 Add changesets config + `pnpm changeset` workflow script (R7.1–R7.2)
- [ ] 4.2 Add npm publish CI workflow triggered on Version PR merge (R7.3)
- [ ] 4.3 Verify `@cenf` npm scope registered on npmjs.org (R7.4 prerequisite)
- [ ] 4.4 Add SBOM + provenance generation per package (R7.5)
- [ ] 4.5 Init Docusaurus site in `docs/`; configure Diátaxis sidebar (R8.1)
- [ ] 4.6 Generate 19 manager reference pages from `AGENTS_API.md` + `api-catalog.json` (R8.2)
- [ ] 4.7 Author 3 Tutorial pages: quick-start, first-project, agent-integration (R8.3)
- [ ] 4.8 Author 4 How-to pages: install, configure, add-adapter, deploy (R8.4)
- [ ] 4.9 Author 3 Explanation pages: monorepo rationale, architecture, tradeoffs (R8.5)
- [ ] 4.10 Author Docusaurus code examples in TypeScript for every page (R8.6)

**Total**: 51 tasks across 11 slices, 4 phases, 4 chained PRs.
