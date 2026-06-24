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

- [x] **TASK_024**: Create `src/managers/observability/ports.ts` + `types.ts` + `errors.ts` — `IObservabilityManager` (`createSpan`, `recordMetric`, `recordError`, `addEvent`), `SpanContext`, `MetricAttributes`, `ObservabilityConfigurationError`. **Lines**: ~45
- [x] **TASK_025**: Create `src/managers/observability/adapters/memory.adapter.ts` — `MemoryObservabilityAdapter`. **Test**: → spans captured with attributes, metrics recorded with values, errors attached to span context. **Lines**: ~40 + ~50 tests
- [x] **TASK_026**: Create `src/managers/observability/adapters/otel.adapter.ts` — `OpenTelemetryAdapter` wrapping `@opentelemetry/api`. **Test**: → parent span → child span with attributes, span.end() records duration, OTel disabled returns no-op span (graceful degradation), recordMetric counter increments. **Lines**: ~55 + ~60 tests

### Phase 3.2: AuthManager

- [x] **TASK_027**: Create `src/managers/auth/ports.ts` + `types.ts` + `errors.ts` — `IAuthManager` (`generateToken`, `verifyToken`, `decodeToken`, `refreshToken`), `TokenPayload`, `TokenOptions`, `TokenPair`, `TokenExpiredError`, `TokenInvalidError`, `TokenVerificationError`. **Lines**: ~50
- [x] **TASK_028**: Create `src/managers/auth/adapters/memory.adapter.ts` — `MemoryAuthAdapter`. **Test**: → generate/verify roundtrip, decode without verification, expired token rejection. **Lines**: ~40 + ~50 tests
- [x] **TASK_029**: Create `src/managers/auth/adapters/jose.adapter.ts` — `JoseAuthAdapter` wrapping `jose` (HS256/RS256). **Test**: → HS256 sign/verify roundtrip, expired token throws TokenExpiredError, audience mismatch throws TokenVerificationError, refresh returns new TokenPair with future expiresAt. **Lines**: ~60 + ~70 tests

---

## PR #4 — Data Layer (`feature/core-cenf-ts-v1-pr4-data` → PR #3 branch)

### Phase 4.1: CacheManager

- [x] **TASK_030**: Create `src/managers/cache/ports.ts` + `types.ts` + `errors.ts` — `CacheManager` (get, set, del, has, clear, getOrSet), `CacheEntry`, `CacheOptions`. **Lines**: ~180 (3 files)
- [x] **TASK_031**: Create `src/managers/cache/adapters/memory.adapter.ts` — `MemoryCacheAdapter` with TTL, XFetch stampede in getOrSet. **Lines**: ~380 (2 files)
- [x] **TASK_032**: SKIPPED — RedisCacheAdapter deferred to PR #5 per user architecture (no ioredis in PR #4)

### Phase 4.2: FeatureFlagManager

- [x] **TASK_033**: Create `src/managers/feature-flag/ports.ts` + `types.ts` + errors — `FeatureFlagManager` (isEnabled, isEnabledForUser, getAllFlags), `FeatureFlag`, `FlagConfig`, `FeatureFlagError`, `FeatureFlagNotFoundError`. **Lines**: ~270 (4 files incl. shared/errors.ts)
- [x] **TASK_034**: Create `src/managers/feature-flag/adapters/memory.adapter.ts` — `MemoryFeatureFlagAdapter` with FNV-1a hash percentage rollout. **Lines**: ~356 (2 files)
- [x] **TASK_035**: SKIPPED — YamlFeatureFlagAdapter not in user architecture for PR #4

### Phase 4.3: RateLimiterManager

- [x] **TASK_036**: Create `src/managers/rate-limiter/ports.ts` + `types.ts` + error — `RateLimiterManager` (consume, getRemaining, reset), `TokenBucket`, `RateLimitConfig`, `RateLimitResult`, `RateLimitExceededError`. **Lines**: ~300 (3 files)
- [x] **TASK_037**: Create `src/managers/rate-limiter/adapters/memory.adapter.ts` — `MemoryRateLimiterAdapter` with token bucket, fake timer refill tests. **Lines**: ~504 (2 files)

---

## PR #5 — Infrastructure (`feature/core-cenf-ts-v1-pr5-infra` → PR #4 branch)

### Phase 5.1: DatabaseManager

- [x] **TASK_038**: Create `src/managers/database/ports.ts` + `types.ts` + `errors.ts` — `IDatabaseManager` (`query`, `transaction`, `health`), `DatabaseConnectionError`, `DatabaseQueryError`, `DatabaseTransactionError`. **Lines**: ~45
- [x] **TASK_039**: Create `src/managers/database/adapters/memory.adapter.ts` — `MemoryDatabaseAdapter` with GenericRepository. **Test**: → INSERT/SELECT/UPDATE/DELETE, transactions with rollback. **Lines**: ~65 + ~60 tests

### Phase 5.2: StorageManager

- [x] **TASK_040**: Barrel export DatabaseManager in `src/index.ts`. **Lines**: ~15
- [x] **TASK_041**: Create `src/managers/storage/ports.ts` + `types.ts` — `StorageManager` (`put`, `get`, `delete`, `list`, `exists`), `StorageObject`, `StorageMetadata`. **Lines**: ~50
- [x] **TASK_042**: Create `src/managers/storage/adapters/memory.adapter.ts` — `MemoryStorageAdapter`. **Test**: → put/get roundtrip, metadata, prefix list, exists, delete idempotent. **Lines**: ~40 + ~45 tests
- [x] **TASK_043**: SKIPPED — S3StorageAdapter deferred; all memory-only for PR #5

### Phase 5.3: HttpClientManager

- [x] **TASK_044**: Create `src/managers/http-client/ports.ts` + `types.ts` — `HttpClientManager` (`get`, `post`, `put`, `patch`, `delete`), `HttpResponse<T>`, `RequestOptions`. **Lines**: ~45
- [x] **TASK_045**: Create `src/managers/http-client/adapters/fetch.adapter.ts` — `FetchHttpClientAdapter` with register() route map. **Test**: → GET/POST/PUT/DELETE/PATCH via registered routes, unregistered throws HttpClientError. **Lines**: ~40 + ~45 tests
- [x] **TASK_046**: Barrel export StorageManager + HttpClientManager in `src/index.ts`. **Lines**: ~20
- [x] **TASK_047**: SKIPPED — UndiciHttpClientAdapter deferred; all memory-only for PR #5

### Phase 5.4: CircuitBreakerManager

- [x] **TASK_048**: Create `src/managers/circuit-breaker/ports.ts` + `types.ts` — `CircuitBreakerManager` (`execute`, `getState`, `reset`), `CircuitState`, `CircuitOptions`. **Lines**: ~40
- [x] **TASK_049**: Create `src/managers/circuit-breaker/adapters/memory.adapter.ts` — `MemoryCircuitBreakerAdapter` (CLOSED → OPEN → HALF_OPEN state machine). **Test**: → threshold opens circuit, OPEN fails fast, HALF_OPEN success closes, failure re-opens, reset clears. **Lines**: ~60 + ~65 tests
- [x] **TASK_050**: Barrel export CircuitBreakerManager in `src/index.ts`. **Lines**: ~15
- [x] **TASK_051**: SKIPPED — OpossumCircuitBreakerAdapter deferred; all memory-only for PR #5

---

## PR #6 — Integration + Bootstrap (`feature/core-cenf-ts-v1-pr6-integration` → PR #5 branch)

### Phase 6.1: EventBusManager

- [x] **TASK_048**: Create `src/managers/event-bus/ports.ts` + `types.ts` — `EventBusManager` (`publish`, `subscribe`, `unsubscribe`, `request`, `reply`). Uses existing error classes from `shared/errors.js`. **Lines**: ~60
- [x] **TASK_049**: Create `src/managers/event-bus/adapters/memory.adapter.ts` — `MemoryEventBusAdapter`. ✅ 16/16 tests: publish/subscribe roundtrip, multiple subscribers, unsubscribe stops delivery, handler error doesn't block, request/reply pattern.
- [x] **TASK_050**: NatsEventBusAdapter — SKIPPED (all memory-only per architecture)

### Phase 6.2: I18nManager

- [x] **TASK_051**: Create `src/managers/i18n/ports.ts` + `types.ts` — `I18nManager` (`t`, `setLocale`, `getLocale`, `loadResources`), `TranslationParams`, `I18nOptions`. Uses existing `I18nError` from `shared/errors.js`.
- [x] **TASK_052**: Create `src/managers/i18n/adapters/memory.adapter.ts` — `MemoryI18nAdapter`. ✅ 16/16 tests: translation lookup, {{param}} interpolation, locale switching, resource merging, stop cleanup.
- [x] **TASK_053**: I18nextAdapter — SKIPPED (all memory-only per architecture)

### Phase 6.3: JsonSerializer

- [x] **TASK_054**: Create `src/managers/json-serializer/ports.ts` + `types.ts` — `JsonSerializer` (`serialize`, `deserialize`, `registerSerializer`), `CustomSerializer`, `SerializerConfig`. Uses existing error classes from `shared/errors.js`.
- [x] **TASK_055**: Create `src/managers/json-serializer/adapters/native.adapter.ts` — `NativeJsonSerializer` with pre-processing for BigInt → string, Date → ISO. ✅ 14/14 tests: round-trips, BigInt serialization/deserialization, Date ISO round-trip, nested, custom serializers.

### Phase 6.4: HealthManager

- [x] **TASK_056**: Create `src/managers/health/ports.ts` + `types.ts` — `HealthManager` (`check`, `register`, `isReady`, `isLive`), `HealthReport`, `ComponentHealth`.
- [x] **TASK_057**: Create `src/managers/health/adapters/aggregated.adapter.ts` — `AggregatedHealthCheckAdapter`. ✅ 16/16 tests: worst-status-wins, healthy when empty, throwing manager marked unhealthy, isReady/isLive probe semantics, stop cleanup.

### Phase 6.5: BootstrapOrchestrator

- [x] **TASK_058**: Create `src/managers/bootstrap/ports.ts` + `types.ts` — `BootstrapOrchestrator` (`register`, `start`, `stop`, `health`), `BootstrapOptions`.
- [x] **TASK_059**: Create `src/managers/bootstrap/adapters/standard.adapter.ts` — `StandardBootstrapAdapter` with priority queue, sequential start, reverse shutdown, rollback on failure. ✅ 10/10 tests: priority order start, rollback, reverse stop, resilient shutdown, duplicate rejection, full lifecycle.
- [x] **TASK_060**: Update `src/index.ts` — final barrel exports: all 19 manager port interfaces, types, all adapter classes, `BootstrapOrchestrator`, `VERSION`. ✅ 27/27 barrel tests.
- [x] **TASK_061**: E2E integration test — `src/managers/bootstrap/__tests__/bootstrap.integration.test.ts` — full bootstrap lifecycle with ALL 19 managers. File exists with 5 test cases. ⚠️ OOM on this machine due to heavy deps (zod, jose, ioredis, pino all loaded simultaneously). To run: increase Node.js heap beyond 8GB or use test splitting.

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
