# Tasks: core-cenf-ts v0.1.0 — 19-Manager Implementation

## REGLAS INVIOLABLES
1. NUNCA escribir fuera de `C:\Dropbox\DOC.RECA\06-Software\core-cenf-ts`
2. TDD estricto: test primero SIEMPRE (red → green → refactor → commit)
3. Work-unit commits: un commit por tarea completada (NO mega-commits)
4. Gitflow: `main ← feature/core-cenf-ts-v1 (tracker) ← feature/core-cenf-ts-v1-prN-*`
5. Granularidad máxima en git y Engram (mem_save tras cada manager completado)
6. Max 250 líneas por archivo fuente — extraer a archivos separados si se excede
7. Google-style JSDoc en TODAS las APIs públicas
8. NO `any` — usar `unknown` o genéricos propios
9. Clases SOLO para adaptadores con estado (conexiones, clientes)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total) | ~5,300 (source ~2,900 + tests ~2,400) |
| Per-PR line range | 620–1,240 lines |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Delivery strategy | force-chained |
| Suggested split | 6 chained PRs (feature-branch-chain) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch | Notes |
|------|------|-----------|-------------|-------|
| 1 | shared/* + config + logging + barrel | PR #1 | feature/core-cenf-ts-v1 | Foundation types, errors, context, lifecycle, both managers with adapters + tests |
| 2 | secret + error-handling + validation | PR #2 | PR #1 branch | Security core with full CenfError hierarchy |
| 3 | observability + auth | PR #3 | PR #2 branch | OTel spans/metrics + JWT with jose |
| 4 | cache + feature-flag + rate-limiter | PR #4 | PR #3 branch | Redis/ioredis, YAML flags, token bucket |
| 5 | database + storage + http-client + circuit-breaker | PR #5 | PR #4 branch | Drizzle, S3, undici, opossum |
| 6 | event-bus + i18n + json-serializer + health + bootstrap | PR #6 | PR #5 branch | NATS, i18next, final wiring + barrel |

---

## PR #1 — Foundation (`feature/core-cenf-ts-v1-pr1-foundation` → tracker)

### Phase 1.1: Shared Infrastructure

- [ ] **TASK_001**: Create `src/shared/errors.ts` — `CenfError` abstract base class (`code: string`) + 18 manager-specific subclasses (ConfigError, ValidationError, SecretError, AuthError, TokenExpiredError, TokenInvalidError, TokenVerificationError, CacheConnectionError, CacheOperationError, DatabaseConnectionError, DatabaseQueryError, DatabaseTransactionError, StorageUploadError, StorageDownloadError, StorageDeleteError, HttpTimeoutError, HttpClientError, CircuitBreakerOpenError, EventBusConnectionError, EventBusPublishError, EventBusSubscriptionError, ObservabilityConfigurationError, I18nError, BootstrapError, ShutdownError, JsonSerializationError, JsonDeserializationError, HealthCheckTimeoutError). **Test**: `src/shared/__tests__/errors.test.ts` → verify each subclass has unique `code`, instanceof CenfError, instanceof Error, stack preserved. **Lines**: ~90
- [ ] **TASK_002**: Create `src/shared/types.ts` — `JsonValue`, `JsonObject`, `Result<T,E>`, `HealthStatus`, `ContextStore`. **Test**: `src/shared/__tests__/types.test.ts` → type-level compile checks. **Lines**: ~40
- [ ] **TASK_003**: Create `src/shared/context.ts` — `AsyncLocalStorage<ContextStore>` wrapper with `run()`, `get()`, `set()` methods. **Test**: `src/shared/__tests__/context.test.ts` → nested context isolation, correlation ID propagation. **Lines**: ~30
- [ ] **TASK_004**: Create `src/shared/lifecycle.ts` — `AsyncLifecycle` interface (`start()`, `stop()`, `health()`). **Test**: `src/shared/__tests__/lifecycle.test.ts` → contract conformance check. **Lines**: ~15
- [ ] **TASK_005**: Create `src/shared/utils.ts` — `retry()`, `exponentialBackoff()`, `sha256Hash()`, `isCenfError()` helpers. **Test**: `src/shared/__tests__/utils.test.ts` → 3 retries exhaust, backoff delay progression, hash determinism. **Lines**: ~40

### Phase 1.2: ConfigManager

- [ ] **TASK_006**: Create `src/managers/config/ports.ts` — `IConfigManager extends AsyncLifecycle` interface: `load<T>(schema)`, `get<T>(key)`, `set(key, value)`, `reload()`. **Lines**: ~20
- [ ] **TASK_007**: Create `src/managers/config/errors.ts` — `ConfigValidationError`, `ConfigNotFoundError`. **Lines**: ~12
- [ ] **TASK_008**: Create `src/managers/config/types.ts` — `ConfigStore`, `EnvConfigOptions`. **Lines**: ~15
- [ ] **TASK_009**: Create `src/managers/config/adapters/env.adapter.ts` — `EnvConfigAdapter implements IConfigManager` (dotenv + Zod validation). **Test**: `src/managers/config/__tests__/env.adapter.test.ts` → valid load returns typed object, missing required field throws ConfigValidationError, set() overrides in-memory without mutating process.env, reload re-reads .env. **Lines**: ~55 + ~90 tests
- [ ] **TASK_010**: Create `src/managers/config/adapters/memory.adapter.ts` — `MemoryConfigAdapter implements IConfigManager` (Map-backed). **Test**: `src/managers/config/__tests__/memory.adapter.test.ts` → set/get roundtrip, reload clears state, health reports. **Lines**: ~40 + ~50 tests

### Phase 1.3: LogManager

- [ ] **TASK_011**: Create `src/managers/logging/ports.ts` — `ILogManager` interface with 5 levels: `debug()`, `info()`, `warn()`, `error()`, `fatal()` + `child(bindings)`. **Lines**: ~20
- [ ] **TASK_012**: Create `src/managers/logging/errors.ts` — `LogConfigurationError`. **Lines**: ~10
- [ ] **TASK_013**: Create `src/managers/logging/types.ts` — `LogLevel`, `LogFormat`, `LogEntry`. **Lines**: ~12
- [ ] **TASK_014**: Create `src/managers/logging/adapters/pino.adapter.ts` — `PinoLogAdapter implements ILogManager` wrapping pino with level filtering, JSON/pretty format. **Test**: `src/managers/logging/__tests__/pino.adapter.test.ts` → info emits JSON with timestamp/level/msg, child inherits parent bindings, error includes stack, warn level suppresses debug, pretty format for local. **Lines**: ~50 + ~90 tests
- [ ] **TASK_015**: Create `src/managers/logging/adapters/memory.adapter.ts` — `MemoryLogAdapter implements ILogManager` for test capture. **Test**: `src/managers/logging/__tests__/memory.adapter.test.ts` → captured entries verifiable, child logger isolation. **Lines**: ~40 + ~50 tests

### Phase 1.4: Barrel Export

- [ ] **TASK_016**: Update `src/index.ts` — export `CenfError`, shared types, `AsyncLifecycle`, `IConfigManager`, `ILogManager`, adapters, `VERSION`. **Test**: `src/__tests__/index.test.ts` → barrel exports all public symbols. **Lines**: ~30 + ~20 tests

---

## PR #2 — Security Core (`feature/core-cenf-ts-v1-pr2-security` → PR #1 branch)

### Phase 2.1: SecretManager

- [ ] **TASK_017**: Create `src/managers/secret/ports.ts` + `types.ts` + `errors.ts` — `ISecretManager` interface (`getSecret`, `setSecret`, `rotateSecret`, `health`), `SecretHealth`, `SecretNotFoundError`, `SecretAccessError`. **Lines**: ~35
- [ ] **TASK_018**: Create `src/managers/secret/adapters/memory.adapter.ts` — `MemorySecretAdapter`. **Test**: → set/get/rotate roundtrip, isolation between instances. **Lines**: ~30 + ~40 tests
- [ ] **TASK_019**: Create `src/managers/secret/adapters/env.adapter.ts` — `EnvSecretAdapter` reads from `process.env`, redacts values from logs. **Test**: → env retrieval, missing secret throws SecretNotFoundError, health reports source. **Lines**: ~35 + ~40 tests

### Phase 2.2: ErrorHandlingManager

- [ ] **TASK_020**: Create `src/managers/error-handling/ports.ts` + `types.ts` + `errors.ts` — `IErrorHandlingManager` with `handle<T>(fn, opts)`, `classify(error)`, `toResponse(error)`. Types: `HandleOptions`, `ErrorClassification`, `ErrorResponse`. **Lines**: ~50
- [ ] **TASK_021**: Create `src/managers/error-handling/adapters/standard.adapter.ts` — `StandardErrorHandlingAdapter`. **Test**: → classify TokenExpiredError → `{category:client, retryable:false}`, unknown Error → `{category:server}`, HttpTimeoutError → `{category:timeout, retryable:true}`, toResponse sanitizes stack for internal errors, handle() retries 2x with backoff then fallback. **Lines**: ~80 + ~120 tests

### Phase 2.3: ValidationManager

- [ ] **TASK_022**: Create `src/managers/validation/ports.ts` + `types.ts` + `errors.ts` — `IValidationManager` with `validate<T>`, `validateAsync<T>`, `validateArray<T>`, `ValidationError`, `ValidationArrayError`. **Lines**: ~40
- [ ] **TASK_023**: Create `src/managers/validation/adapters/zod.adapter.ts` — `ZodValidationAdapter`. **Test**: → valid sync passes, invalid throws with field details, async refine executes, array with partial failures identifies index, max array limit enforced at 1000. **Lines**: ~50 + ~80 tests

---

## PR #3 — Observability + Auth (`feature/core-cenf-ts-v1-pr3-observability` → PR #2 branch)

### Phase 3.1: ObservabilityManager

- [ ] **TASK_024**: Create `src/managers/observability/ports.ts` + `types.ts` + `errors.ts` — `IObservabilityManager` (`createSpan`, `recordMetric`, `recordError`, `addEvent`), `SpanContext`, `MetricAttributes`, `ObservabilityConfigurationError`. **Lines**: ~45
- [ ] **TASK_025**: Create `src/managers/observability/adapters/memory.adapter.ts` — `MemoryObservabilityAdapter`. **Test**: → spans captured with attributes, metrics recorded with values, errors attached to span context. **Lines**: ~40 + ~50 tests
- [ ] **TASK_026**: Create `src/managers/observability/adapters/otel.adapter.ts` — `OpenTelemetryAdapter` wrapping `@opentelemetry/api`. **Test**: → parent span → child span with attributes, span.end() records duration, OTel disabled returns no-op span (graceful degradation), recordMetric counter increments. **Lines**: ~55 + ~60 tests

### Phase 3.2: AuthManager

- [ ] **TASK_027**: Create `src/managers/auth/ports.ts` + `types.ts` + `errors.ts` — `IAuthManager` (`generateToken`, `verifyToken`, `decodeToken`, `refreshToken`), `TokenPayload`, `TokenOptions`, `TokenPair`, `TokenExpiredError`, `TokenInvalidError`, `TokenVerificationError`. **Lines**: ~50
- [ ] **TASK_028**: Create `src/managers/auth/adapters/memory.adapter.ts` — `MemoryAuthAdapter`. **Test**: → generate/verify roundtrip, decode without verification, expired token rejection. **Lines**: ~40 + ~50 tests
- [ ] **TASK_029**: Create `src/managers/auth/adapters/jose.adapter.ts` — `JoseAuthAdapter` wrapping `jose` (HS256/RS256). **Test**: → HS256 sign/verify roundtrip, expired token throws TokenExpiredError, audience mismatch throws TokenVerificationError, refresh returns new TokenPair with future expiresAt. **Lines**: ~60 + ~70 tests

---

## PR #4 — Data Layer (`feature/core-cenf-ts-v1-pr4-data` → PR #3 branch)

### Phase 4.1: CacheManager

- [ ] **TASK_030**: Create `src/managers/cache/ports.ts` + `types.ts` + `errors.ts` — `ICacheManager` (`get`, `set`, `del`, `exists`, `clear`, `getOrSet`, `health`), `CacheHealth`, `CacheConnectionError`, `CacheOperationError`. **Lines**: ~45
- [ ] **TASK_031**: Create `src/managers/cache/adapters/memory.adapter.ts` — `MemoryCacheAdapter` with TTL eviction via interval sweep. **Test**: → set/get with TTL, expired returns undefined, delete idempotent, clear empties all. **Lines**: ~50 + ~55 tests
- [ ] **TASK_032**: Create `src/managers/cache/adapters/redis.adapter.ts` — `RedisCacheAdapter` wrapping `ioredis` with JSON serialization. **Test**: → PING health, getOrSet with XFetch early recompute near expiry, normal get skips factory, cache miss triggers factory, connection failure → CacheConnectionError. **Lines**: ~60 + ~65 tests

### Phase 4.2: FeatureFlagManager

- [ ] **TASK_033**: Create `src/managers/feature-flag/ports.ts` + `types.ts` + `errors.ts` — `IFeatureFlagManager` (`isEnabled`, `getVariant`, `reload`), `FeatureFlag`, `FeatureFlagConfig`. **Lines**: ~40
- [ ] **TASK_034**: Create `src/managers/feature-flag/adapters/memory.adapter.ts` — `MemoryFeatureFlagAdapter`. **Test**: → boolean flag resolution, percentage rollout distribution within tolerance, reload updates flags. **Lines**: ~35 + ~40 tests
- [ ] **TASK_035**: Create `src/managers/feature-flag/adapters/yaml.adapter.ts` — `YamlFeatureFlagAdapter` loading from YAML file. **Test**: → YAML parse, env override, missing file graceful fallback. **Lines**: ~40 + ~40 tests

### Phase 4.3: RateLimiterManager

- [ ] **TASK_036**: Create `src/managers/rate-limiter/ports.ts` + `types.ts` + `errors.ts` — `IRateLimiterManager` (`consume`, `reset`, `status`), `TokenBucket`, `RateLimitStatus`. Zero dependencies. **Lines**: ~40
- [ ] **TASK_037**: Create `src/managers/rate-limiter/adapters/token-bucket.adapter.ts` — `TokenBucketAdapter` with refill interval. **Test**: → consume within limit passes, exceed limit throws, refill restores tokens over time, different keys have independent buckets. **Lines**: ~50 + ~55 tests

---

## PR #5 — Infrastructure (`feature/core-cenf-ts-v1-pr5-infra` → PR #4 branch)

### Phase 5.1: DatabaseManager

- [ ] **TASK_038**: Create `src/managers/database/ports.ts` + `types.ts` + `errors.ts` — `IDatabaseManager` (`query`, `transaction`, `health`), `DatabaseConnectionError`, `DatabaseQueryError`, `DatabaseTransactionError`. **Lines**: ~45
- [ ] **TASK_039**: Create `src/managers/database/adapters/drizzle.adapter.ts` — `DrizzleDatabaseAdapter` wrapping Drizzle ORM ≥0.45.2. **Test**: → query returns typed rows, transaction rolls back on error, health PING, connection failure → DatabaseConnectionError. **Lines**: ~65 + ~60 tests

### Phase 5.2: StorageManager

- [ ] **TASK_040**: Create `src/managers/storage/ports.ts` + `types.ts` + `errors.ts` — `IStorageManager` (`upload`, `download`, `delete`, `list`, `health`), `StorageUploadError`, `StorageDownloadError`, `StorageDeleteError`. **Lines**: ~50
- [ ] **TASK_041**: Create `src/managers/storage/adapters/memory.adapter.ts` — `MemoryStorageAdapter`. **Test**: → upload/download roundtrip, delete removes, list returns keys. **Lines**: ~40 + ~45 tests
- [ ] **TASK_042**: Create `src/managers/storage/adapters/s3.adapter.ts` — `S3StorageAdapter` wrapping `@aws-sdk/client-s3`. **Test**: → upload with streaming, download with range, delete object, list with prefix, health bucket check. **Lines**: ~55 + ~55 tests

### Phase 5.3: HttpClientManager

- [ ] **TASK_043**: Create `src/managers/http-client/ports.ts` + `types.ts` + `errors.ts` — `IHttpClientManager` (`get`, `post`, `put`, `patch`, `delete`), `HttpClientError`, `HttpTimeoutError`, `RequestOptions`, `HttpResponse<T>`. **Lines**: ~45
- [ ] **TASK_044**: Create `src/managers/http-client/adapters/mock.adapter.ts` — `MockHttpClientAdapter` with predefined response map. **Test**: → GET returns mocked response, POST with body serialized, non-2xx throws HttpClientError. **Lines**: ~40 + ~45 tests
- [ ] **TASK_045**: Create `src/managers/http-client/adapters/undici.adapter.ts` — `UndiciHttpClientAdapter` wrapping undici with retry/backoff/timeout. **Test**: → retry on 502 then succeed, timeout aborts after deadline, AbortSignal cancels, Content-Type auto-set for JSON. **Lines**: ~55 + ~55 tests

### Phase 5.4: CircuitBreakerManager

- [ ] **TASK_046**: Create `src/managers/circuit-breaker/ports.ts` + `types.ts` + `errors.ts` — `ICircuitBreakerManager` (`call`, `status`, `reset`), `CircuitBreakerOpenError`, `CircuitBreakerStatus`. **Lines**: ~40
- [ ] **TASK_047**: Create `src/managers/circuit-breaker/adapters/opossum.adapter.ts` — `OpossumCircuitBreakerAdapter`. **Test**: → closed state normal pass, open after threshold failures (throws immediately), half-open recovery test succeeds → closes, fallback invoked on open circuit, manual reset clears state. **Lines**: ~60 + ~65 tests

---

## PR #6 — Integration + Bootstrap (`feature/core-cenf-ts-v1-pr6-integration` → PR #5 branch)

### Phase 6.1: EventBusManager

- [ ] **TASK_048**: Create `src/managers/event-bus/ports.ts` + `types.ts` + `errors.ts` — `IEventBusManager` (`publish`, `subscribe`, `unsubscribe`, `health`), `EventBusHealth`, `EventBusConnectionError`, `EventBusPublishError`, `EventBusSubscriptionError`. **Lines**: ~45
- [ ] **TASK_049**: Create `src/managers/event-bus/adapters/memory.adapter.ts` — `MemoryEventBusAdapter`. **Test**: → publish/subscribe roundtrip, multiple subscribers receive same message, unsubscribe stops delivery, handler error doesn't block other subscribers. **Lines**: ~40 + ~50 tests
- [ ] **TASK_050**: Create `src/managers/event-bus/adapters/nats.adapter.ts` — `NatsEventBusAdapter` wrapping `@nats-io/nats-core` v3. **Test**: → CloudEvents envelope wrapping (specversion, type, source, id, time), health reports connection + subscription count. **Lines**: ~55 + ~55 tests

### Phase 6.2: I18nManager

- [ ] **TASK_051**: Create `src/managers/i18n/ports.ts` + `types.ts` + `errors.ts` — `II18nManager` (`translate`, `setLanguage`, `getLanguage`), `I18nError`. **Lines**: ~35
- [ ] **TASK_052**: Create `src/managers/i18n/adapters/i18next.adapter.ts` — `I18nextAdapter` with YAML resource loading, interpolation, fallback language. **Test**: → simple translation, parameter interpolation, fallback to default, runtime language switch, missing key returns key name. **Lines**: ~55 + ~55 tests

### Phase 6.3: JsonSerializer

- [ ] **TASK_053**: Create `src/managers/json-serializer/ports.ts` + `types.ts` + `errors.ts` — `IJsonSerializer` (`serialize`, `deserialize`), `JsonSerializationError`, `JsonDeserializationError`, `SerializeOptions`, `DeserializeOptions`. **Lines**: ~40
- [ ] **TASK_054**: Create `src/managers/json-serializer/adapters/native.adapter.ts` — `NativeJsonSerializer` with custom replacer/reviver for BigInt → string, Date → ISO/timestamp. **Test**: → BigInt serialize as string, Date ISO serialize/deserialize roundtrip, circular reference throws JsonSerializationError, strict mode deserialization. **Lines**: ~45 + ~45 tests

### Phase 6.4: HealthManager

- [ ] **TASK_055**: Create `src/managers/health/ports.ts` + `types.ts` + `errors.ts` — `IHealthManager` (`register`, `check` aggregated + single), `HealthReport`, `HealthCheckTimeoutError`. **Lines**: ~40
- [ ] **TASK_056**: Create `src/managers/health/adapters/aggregated.adapter.ts` — `AggregatedHealthAdapter` with timeout per check. **Test**: → single check returns result, aggregate picks worst status (degraded if any degraded), check timeout → unhealthy, check throws caught as unhealthy, empty registry → healthy. **Lines**: ~50 + ~55 tests

### Phase 6.5: BootstrapOrchestrator

- [ ] **TASK_057**: Create `src/managers/bootstrap/ports.ts` + `types.ts` + `errors.ts` — `IBootstrapOrchestrator` (`register(name, manager, priority)`, `start()`, `shutdown()`), `BootstrapError`, `ShutdownError`. **Lines**: ~40
- [ ] **TASK_058**: Create `src/managers/bootstrap/adapters/standard.adapter.ts` — `StandardBootstrapOrchestrator` with priority queue, sequential start, reverse shutdown. **Test**: → starts in priority order (config 0 → logger 1 → db 10), startup failure rolls back already-started in reverse, duplicate registration rejected, shutdown in reverse order, shutdown error doesn't block others, empty shutdown no-ops. **Lines**: ~70 + ~85 tests

### Phase 6.6: Final Integration

- [ ] **TASK_059**: Update `src/index.ts` — final barrel exports: all 19 port interfaces, shared types/errors, all adapter classes, `BootstrapOrchestrator`, `VERSION`. Ensure tree-shaking via named exports. **Lines**: ~40
- [ ] **TASK_060**: Verify `tsup.config.ts` — ESM + CJS + dts bundles, subpath exports in `package.json`, `prepublishOnly` runs tests. **Test**: `npm run build` succeeds, `dist/` contains all entry points. **Lines**: ~15 + ~10 config changes
- [ ] **TASK_061**: E2E smoke test — full bootstrap lifecycle: `register` all 19 managers → `start()` → `health()` → `shutdown()`. **Test**: `src/__tests__/e2e/bootstrap.test.ts` → all managers start in order, health aggregate reports all, shutdown graceful. **Lines**: ~40 + ~40 tests

---

## Summary

| PR | Managers | Source Files | Test Files | Est. Lines |
|----|----------|-------------|------------|------------|
| #1 | shared + config + logging | 14 | 8 | ~720 |
| #2 | secret + error-handling + validation | 12 | 6 | ~830 |
| #3 | observability + auth | 8 | 6 | ~620 |
| #4 | cache + feature-flag + rate-limiter | 11 | 7 | ~780 |
| #5 | database + storage + http-client + circuit-breaker | 12 | 8 | ~1,110 |
| #6 | event-bus + i18n + json-serializer + health + bootstrap | 14 | 9 | ~1,240 |
| **Total** | **19 managers** | **71** | **44** | **~5,300** |

### Implementation Order
PRs must execute sequentially (feature-branch-chain): #1 → #2 → #3 → #4 → #5 → #6. Each PR depends on the merged artifacts of the previous PR. Tests for PR border-crossing dependencies should use memory adapters from prior PRs.

### Next Step
`sdd-apply` for PR #1 — Foundation. Create branch `feature/core-cenf-ts-v1-pr1-foundation` from `feature/core-cenf-ts-v1` tracker. Execute TASKS 001–016 in order.
