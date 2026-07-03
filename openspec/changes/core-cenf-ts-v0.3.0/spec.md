# Specs: core-cenf-ts v0.3.0

**Change**: core-cenf-ts-v0.3.0
**Total requirements**: 42
**Total scenarios**: 85

---

## 1. monorepo-foundation

### Requirements
- **R1.1**: pnpm workspace with `packages/*` glob
- **R1.2**: turborepo `turbo.json` with build/test/lint pipelines
- **R1.3**: Root `package.json` has `private: true`
- **R1.4**: `@cenf/core` package extracted with shared primitives (errors, types, lifecycle, context, utils)
- **R1.5**: Cross-package dependencies use `workspace:*` protocol

### Scenarios
- GIVEN monorepo is initialized, WHEN `pnpm install`, THEN all workspace packages resolve
- GIVEN `@cenf/core` is published, WHEN `@cenf/config` depends on `workspace:*`, THEN import resolves correctly
- GIVEN turbo is configured, WHEN `turbo run build`, THEN packages build in dependency order

---

## 2. package-migration (19 managers → 19 packages)

### Requirements
- **R2.1**: Each of 19 managers extracted to own package under `packages/<name>/`
- **R2.2**: All 819 existing tests pass after migration
- **R2.3**: Barrel exports preserved via `@cenf/core` re-exports
- **R2.4**: Import paths updated from relative (`../../shared/errors.js`) to package (`@cenf/core`)

### Scenarios
- GIVEN existing `ConfigManager`, WHEN migrated to `@cenf/config`, THEN same test suite passes without changes
- GIVEN `@cenf/core` exports `CenfError`, WHEN `@cenf/cache` imports it, THEN type resolution works
- GIVEN all 19 packages extracted, WHEN `pnpm test`, THEN 819 tests pass

---

## 3. nats-event-bus-adapter (JetStream)

### Requirements
- **R3.1**: NatsEventBusAdapter implements EventBusManager port
- **R3.2**: Supports Core NATS: publish, subscribe, unsubscribe, request, reply
- **R3.3**: Supports JetStream: stream create/delete, consumer create/delete, persistent publish/subscribe
- **R3.4**: JetStream KV store: put/get/delete/watch
- **R3.5**: Connection management: auto-reconnect, max reconnect attempts
- **R3.6**: CloudEvents envelope for all messages

### Scenarios
- GIVEN NATS connection, WHEN publish to subject, THEN subscribers receive message
- GIVEN JetStream stream, WHEN publish persistent, THEN message survives consumer restart
- GIVEN JetStream KV, WHEN put key-value, THEN get returns value
- GIVEN NATS disconnected, WHEN auto-reconnect enabled, THEN reconnection succeeds within timeout

---

## 4. otel-adapter (Tracing + Metrics)

### Requirements
- **R4.1**: OTelAdapter implements ObservabilityManager port
- **R4.2**: Tracing: createSpan, setAttribute, recordException, addEvent, getActiveSpan
- **R4.3**: Metrics: createCounter, createHistogram, createGauge
- **R4.4**: Context propagation via AsyncLocalStorage bridge to OTel context
- **R4.5**: Exporters: OTLP (gRPC/HTTP), Console (dev)

### Scenarios
- GIVEN OTel SDK initialized, WHEN createSpan, THEN span exported to collector
- GIVEN active span, WHEN setAttribute, THEN attribute visible in trace
- GIVEN counter created, WHEN increment, THEN metric value increases
- GIVEN histogram created, WHEN record values, THEN percentiles calculable

---

## 5. production-adapters (remaining 5)

### Requirements
- **R5.1**: UndiciHttpClientAdapter: GET/POST/PUT/DELETE/PATCH with retry, timeout, interceptors
- **R5.2**: OpossumCircuitBreakerAdapter: CLOSED→OPEN→HALF_OPEN state machine with configurable thresholds
- **R5.3**: RedisRateLimiterAdapter: distributed token bucket via Redis Lua scripts
- **R5.4**: I18nextAdapter: locale detection, resource loading, interpolation, pluralization
- **R5.5**: UnleashFeatureFlagAdapter: server-side evaluation, gradual rollout, toggle targeting

### Scenarios (1 per adapter)
- GIVEN HTTP request to external API, WHEN retry configured, THEN transient failures retried
- GIVEN circuit CLOSED, WHEN failure threshold exceeded, THEN circuit OPENS
- GIVEN rate limit bucket, WHEN tokens consumed across instances, THEN global limit enforced
- GIVEN locale set to 'es', WHEN t('hello'), THEN returns Spanish translation
- GIVEN feature flag 'beta' at 30%, WHEN 1000 users evaluated, THEN ~30% get enabled

---

## 6. new-managers (TaskQueue, Permission, Licence)

### Requirements
- **R6.1**: TaskQueueManager: add job, process jobs, retry, dead letter queue, concurrency
- **R6.2**: TaskQueueManager: job scheduling (delay, repeat, cron)
- **R6.3**: PermissionManager: enforce(model, subject, object, action) → boolean
- **R6.4**: PermissionManager: RBAC + ABAC via casbin model files
- **R6.5**: LicenceManager: sign(claims) → JWT, verify(token) → claims, checkGrace(claims) → days remaining

### Scenarios
- GIVEN job added to queue, WHEN worker processes, THEN job handler invoked
- GIVEN RBAC model, WHEN subject has role, THEN permission check passes
- GIVEN licence JWT with expiry, WHEN within grace period, THEN checkGrace returns positive

---

## 7. ci-cd-publish

### Requirements
- **R7.1**: changesets configured for per-package versioning
- **R7.2**: `pnpm changeset` workflow for creating version PRs
- **R7.3**: npm publish CI workflow (publish on version PR merge)
- **R7.4**: `@cenf` scope registered on npmjs.org (prerequisite)
- **R7.5**: SBOM + provenance per package

### Scenarios
- GIVEN changeset added, WHEN version PR created, THEN packages get correct semver bump
- GIVEN version PR merged, WHEN publish CI runs, THEN all changed packages published to npm

---

## 8. docusaurus

### Requirements
- **R8.1**: 30 pages following Diátaxis (Tutorial, How-to, Reference, Explanation)
- **R8.2**: 19 manager reference pages generated from AGENTS_API.md + api-catalog.json
- **R8.3**: Tutorial: quick-start, first project, agent integration
- **R8.4**: How-to: install, configure, add adapter, test, deploy
- **R8.5**: Explanation: architecture decisions, monorepo rationale, tradeoffs
- **R8.6**: Code examples in TypeScript for every page

### Scenarios
- GIVEN Docusaurus dev server, WHEN navigate to /docs, THEN sidebar shows all 30 pages
- GIVEN CacheManager reference page, WHEN scroll to code example, THEN TypeScript snippet compiles
