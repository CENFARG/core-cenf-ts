# Test Engineer Audit — core-cenf-ts v0.2.0

**Date**: 2026-06-25
**Auditor**: R3 Reliability (read-only reviewer)
**Scope**: Full test suite (69 test files, ~740 tests)
**Executed**: `npx vitest run --exclude "**/bootstrap.integration.test.ts" NODE_OPTIONS=--max-old-space-size=8192`
**Result**: 62/69 files passed; OOM crash on 63rd file. All executed tests were green.

---

## 1. Test Coverage: What's Tested vs What's Missing

### What IS tested (strong)
- All 19 managers have **port contract tests** (structural interface verification)
- All 19 managers have **memory adapter tests** (behavioral verification)
- **Real adapter tests**: S3 (`s3.adapter.test.ts`, 23 tests), Redis (`redis.adapter.test.ts`, 25 tests), Drizzle (`drizzle.adapter.test.ts`, 19 tests), Pino (`pino.adapter.test.ts`, 7 tests), Jose JWT (`jose.adapter.test.ts`, 20 tests), Env config (`env.adapter.test.ts`, 15 tests), Env secret (`env.adapter.test.ts`, 13 tests)
- **Integration tests**: Bootstrap lifecycle with managers grouped by category (core, infra, orch-A, orch-B)
- **E2E smoke test**: blind_agent_demo.test.ts — all 19 managers wired and started
- Shared: errors hierarchy, types, utils, context, lifecycle
- Barrel export test (`index.test.ts`, 27 tests)

### What is MISSING

| Severity | File / Area | Evidence | Recommendation |
|----------|------------|----------|----------------|
| **CRITICAL** | `src/managers/event-bus/adapters/` | No NATS adapter exists. Only `memory.adapter.ts`. `@nats-io/nats-core` is a runtime dependency with zero test coverage. | Either write a `nats.adapter.ts` with tests, or remove the unused dependency. |
| **CRITICAL** | `src/managers/database/adapters/` | `@prisma/client` is in devDependencies, but no Prisma adapter or tests exist. | Either create `prisma.adapter.ts` with tests, or remove the devDependency. |
| **WARNING** | `src/managers/http-client/adapters/` | No undici-based real adapter. The `FetchHttpClientAdapter` is effectively a mock registry, not a real HTTP client. `undici` is in dependencies but only the mock adapter is exported. | Add a real `undici.adapter.ts` with retry/timeout behavior and tests. |
| **WARNING** | `src/managers/validation/` | Only Zod adapter exists. No tests for custom validation adapter or port-level error propagation edge cases beyond Zod. | Consider a `memory.adapter.ts` for validation if needed. |
| **SUGGESTION** | `src/managers/circuit-breaker/` | No real opossum-based adapter tests. Memory adapter simulates circuit breaker but `opossum` is in dependencies. | Add integration smoke test that exercises the real opossum adapter. |
| **SUGGESTION** | `src/managers/i18n/` | Only memory adapter. `i18next` is in dependencies but no real adapter or test exists. | Add an `i18next.adapter.ts` with tests. |

### Coverage threshold compliance
- `vitest.config.ts` sets thresholds: 80% statements, 75% branches, 80% functions, 80% lines
- Port files are excluded from coverage (`src/**/*.port.ts`)
- **No coverage run was executed** (OOM prevented it)
- **No CI runs coverage** (no `.github/workflows/`)

---

## 2. Test Quality: Behavior-Focused vs Implementation-Focused

### Behavior-focused (good)
- **Cache memory adapter**: Tests consumer-visible behavior — `set() / get()` roundtrip, TTL expiration, `getOrSet()` factory semantics, `del()` idempotency. All assertions verify user-facing outcomes.
- **CircuitBreaker memory adapter**: Tests state machine transitions (CLOSED→OPEN→HALF_OPEN→CLOSED), `execute()` semantics, `reset()`. Excellent behavior-driven design.
- **RateLimiter memory adapter**: Tests token consumption, refill over time (with fake timers), key isolation, capacity capping. Strong edge case coverage.
- **Secret env adapter**: Tests that secret values don't leak in error messages, that `set()` doesn't mutate `process.env`. Security-aware testing.
- **Integration bootstrap tests**: Verify lifecycle (start → health → stop → degraded), cross-manager interactions.

### Implementation-focused (concerning)
| Severity | File:Line | Evidence | Recommendation |
|----------|-----------|----------|----------------|
| **WARNING** | `src/managers/observability/__tests__/ports.test.ts` | Tests like "`setAttribute() does not throw`", "`recordException() does not throw`", "`addEvent() does not throw`" verify no-op implementations, not observable behavior. No assertion on side effects or state changes. | Restructure: verify that calling these methods on active spans actually records data. |
| **WARNING** | `src/managers/event-bus/__tests__/ports.test.ts` | Entire file is compile-time signature checks (`typeof fn === 'function'`). These tests never exercise behavior — they only prove the TypeScript compiles. | Port tests should verify contract behavior with a test implementation, like `cache/__tests__/ports.test.ts` does. |
| **WARNING** | `src/managers/cache/__tests__/ports.test.ts:106-112` | "fulfills the AsyncLifecycle contract" tests a no-op test implementation, not actual adapter behavior. | OK as a contract test, but ensure actual adapters are tested independently. |
| **SUGGESTION** | `tests/integration/diag-*.test.ts` (5 files) | Diagnostic "import tests" like `diag-combo.test.ts` only check `expect(x).toBeDefined()`. These are construction-only tests with no behavioral verification. | Merge into integration test suites or remove; they add test count without coverage value. |
| **SUGGESTION** | `src/__tests__/index.test.ts` | Barrel export tests verify exports exist but don't verify they work. | Acceptable for barrel validation, but document that behavioral tests exist elsewhere. |

---

## 3. Edge Cases: Boundaries, Invalid Inputs, Empty States, Retries

### Well-covered ✓
- **Cache**: TTL=0 (immediately expired), missing keys → null, `clear()` on empty cache, `del()` on missing key (idempotent), `getOrSet()` with expired entry re-invokes factory
- **RateLimiter**: consume(0), consume(-1), exhaust bucket, burst consumption, refill cap at capacity, refill with custom interval
- **CircuitBreaker**: OPEN → fail fast (fn never executed), HALF_OPEN with success/failure path, `reset()` from OPEN and HALF_OPEN, halfOpenMaxCalls limit
- **Config**: required field missing → ConfigValidationError, invalid type → ConfigValidationError, defaults applied, `set()` doesn't mutate `process.env`, missing `.env` file handled gracefully
- **Secret**: missing env var → SecretNotFoundError, error message doesn't leak values, `has()` for env+runetime keys, `list()` excludes values
- **Validation**: async refinement rejects, sync validation in async path, coercion, nested object errors, single field error
- **EventBus**: handler error doesn't propagate (fire-and-forget), unsubscribe unknown ID (idempotent), request without reply handler → error, stop() clears all
- **Storage (S3)**: NoSuchKey → null, non-NoSuchKey → StorageDownloadError, delete idempotent on missing, empty bucket list → `[]`
- **Auth (Jose)**: garbage token verification throws

### Missing / Insufficient

| Severity | Area | Missing Edge Case | Recommendation |
|----------|------|-------------------|----------------|
| **BLOCKER** | Cache | **Concurrent access / cache stampede**. `getOrSet()` with concurrent callers should only invoke the factory once. No test verifies this. | Add concurrent `getOrSet()` test with `Promise.all()`. |
| **BLOCKER** | Cache | **Integer overflow on TTL**. Setting `Date.now() + ttlMs` could overflow for absurd TTL values. No boundary check. | Test with `Number.MAX_SAFE_INTEGER` TTL. |
| **BLOCKER** | Database | **Connection failure recovery**. Memory adapter always succeeds — no test for connection drops, query timeouts, or retry logic. | Add adapter test for connection failure → DatabaseConnectionError. |
| **BLOCKER** | HttpClient | **Timeout simulation**. FetchHttpClientAdapter is a mock; no real HTTP timeout test. `undici` retry semantics untested. | Add timeout test or a real adapter with timeout behavior. |
| **BLOCKER** | Storage | **Large file handling**. No test for multi-part upload or files exceeding memory limits. | Add boundary test for large buffers (e.g., 100MB). |
| **WARNING** | RateLimiter | **Clock skew / negative time advancement**. Fake timers test forward advancement only. | Test behavior when system clock jumps backward. |
| **WARNING** | Config (Env) | **Empty string vs missing**. `z.string().default()` behaves differently for `""` vs absent. Borderline case untested. | Test empty string handling explicitly. |
| **WARNING** | EventBus | **Concurrent publish/subscribe/unsubscribe**. No race condition tests. | Add concurrent operation test with `Promise.all()`. |
| **WARNING** | Auth | **Token expiry**. `MemoryAuthAdapter` can sign tokens but no expiry test. `JoseJwtAdapter` expiry behavior tested? | Verify expired token rejection for both adapters. |
| **SUGGESTION** | Bootstrap | **Duplicate registration**. Registering two managers with the same name/priority — does it throw? | Test duplicate registration error behavior. |
| **SUGGESTION** | Health | **Timeout component**. `HealthCheckTimeoutError` error class exists but no test exercises it. | Add test where a registered component times out. |

---

## 4. Test Isolation: Can Tests Run Independently?

### Strong isolation practices ✓
- `beforeEach`/`afterEach` used in unit adapter tests to create fresh instances
- `beforeAll`/`afterAll` used in integration tests with proper stop/cleanup
- Fake timers wrapped in `try { ... } finally { vi.useRealTimers() }`
- `process.env` snapshotted and restored in env adapter tests
- `vi.clearAllMocks()` called in S3 adapter `beforeEach`
- Integration tests create isolated bootstrap instances when testing stop behavior

### Concerns

| Severity | File:Line | Evidence | Recommendation |
|----------|-----------|----------|----------------|
| **WARNING** | `tests/integration/bootstrap-core.test.ts:78-91` | Creates an isolated bootstrap for the "degraded after stop" test — good. But other tests in the same file share the `beforeAll`-initialized bootstrap. A test that calls `config.set()` could leak state to subsequent tests. | Use `beforeEach` for integration tests that mutate shared state, or create fresh instances per test. |
| **WARNING** | `tests/e2e/e2e.test.ts` | Shared `beforeAll`-initialized bootstrap. Cache and auth state mutated in individual tests without reset between tests. | Tests within the file currently don't conflict, but adding new tests could introduce ordering dependencies. Document the sequential dependency or use `beforeEach`. |
| **SUGGESTION** | `src/managers/secret/__tests__/env.adapter.test.ts:6-11` | Global `beforeEach` deletes individual `process.env` keys by name. If a new test adds a key and forgets to clean it, subsequent tests leak. | Use `beforeEach` with a full env snapshot/restore instead of per-key cleanup. |

---

## 5. CI Integration: Is the CI Config Optimal?

### BLOCKER — No CI pipeline exists

| Severity | Evidence | Recommendation |
|----------|----------|----------------|
| **BLOCKER** | No `.github/workflows/` directory exists. Zero CI configuration. | Create a GitHub Actions workflow that runs: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`. |
| **BLOCKER** | `vitest.config.ts` sets coverage thresholds (80/75/80/80) but they are never enforced because no CI runs coverage. | Add `npm run test:coverage` to CI with `--coverage.thresholdAutoUpdate=false`. |
| **BLOCKER** | ESLint (`eslint.config.js`) and Prettier (`.prettierrc`) are configured but never run in automation. | Add `npm run lint` and `npm run format:check` to CI. |
| **CRITICAL** | No `forbidOnly` or `allowOnly` in vitest config. CI could pass with `test.only` skipping tests silently. | Add `test: { allowOnly: false }` or configure `@vitest/no-focused-tests` ESLint rule. |
| **WARNING** | 8 separate vitest config files (`vitest.integration.config.ts`, `vitest.dc.config.ts`, etc.) with no CI orchestrator script. | Consolidate into a single `vitest.workspace.ts` or provide a `npm run test:ci` script that runs all suites with proper flags. |
| **WARNING** | `vitest.integration.config.ts` uses `pool: 'forks'` with `singleFork: true` — sequential execution, not parallel. | Document why; consider `pool: 'threads'` for faster execution. |
| **SUGGESTION** | `bootstrap.integration.test.ts` is permanently skipped (`.skip`) due to OOM. | Split into smaller files or implement a memory-efficient test runner strategy. |

---

## 6. Performance: Slow Tests, Flaky Tests

### Slow tests identified

| File | Duration | Reason | Recommendation |
|------|----------|--------|----------------|
| `circuit-breaker/__tests__/memory.adapter.test.ts` | **666ms** | Real `setTimeout(150)` waits for HALF_OPEN transition in 4 tests | Use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` instead of real timers. |
| `auth/__tests__/jose.adapter.test.ts` | **484ms** | Real JWT crypto operations (HS256 signing/verification) | Acceptable for cryptographic adapter test. Can mock `jose` for unit, keep real for integration. |
| `examples/blind_agent_demo.test.ts` | **84ms** | Real 50ms `setTimeout` for event bus async delivery | Replace `setTimeout(50)` with `vi.advanceTimersByTime(50)` under fake timers. |
| `shared/__tests__/errors.test.ts` | **59ms** | Iterates over 27 error classes with stack trace checks | Acceptable. Consider reducing to sampled classes if time becomes critical. |
| `shared/__tests__/utils.test.ts` | **106ms** | Likely real timeout/retry tests | Investigate — retry tests should use fake timers. |

### OOM risk

| Severity | Evidence | Recommendation |
|----------|----------|----------------|
| **BLOCKER** | Full 19-manager bootstrap integration test (`bootstrap.integration.test.ts`) OOMs on <16GB machines. The run crashed at ~9GB heap usage on 8GB NODE_OPTIONS limit. | The current split (`bootstrap-core`, `bootstrap-infra`, `bootstrap-orch-a`, `bootstrap-orch-b`) works but the original file is still in the tree with `.skip`. Remove or mark as `test.skipIf(process.env.CI_LARGE_MEMORY !== 'true')`. |
| **WARNING** | Running all tests in a single vitest process loads all 69 test files into memory simultaneously, causing cumulative heap pressure. | Use `vitest.workspace.ts` to split into separate projects: unit, integration, e2e. Running independently reduces peak memory. |

### Flaky tests
- No flaky tests observed in this run — all 62 executed files passed green.
- However, circuit breaker tests with real `setTimeout(150)` are susceptible to CI environment timing variations.
- Event bus test in `blind_agent_demo.test.ts` uses `setTimeout(50)` for async delivery — fragile.

---

## 7. Test Naming: Clear Intent?

### Good examples ✓
- `"set() and get() roundtrip a string value"` — clear action + expected outcome
- `"get() returns null for missing key"` — edge case explicitly stated
- `"execute() throws CircuitBreakerOpenError when OPEN"` — behavior + state precondition
- `"consume() within capacity returns allowed:true"` — input condition + output assertion
- `"get() error message does NOT contain secret value for other lookups"` — security property documented
- `"publish is fire-and-forget — handler error does not propagate"` — architectural property captured

### Needs improvement

| Severity | File:Line | Evidence | Recommendation |
|----------|-----------|----------|----------------|
| **SUGGESTION** | `tests/integration/diag-*.test.ts` | `"can instantiate all"`, `"can instantiate event bus"`, `"bootstrap reports healthy"` — generic names that don't convey what's being verified or why. | Rename to describe the specific scenario: `"EventBus adapter imports without side effects"`, `"Bootstrap with event bus and json-serializer starts healthy"`. |
| **SUGGESTION** | `src/managers/event-bus/__tests__/ports.test.ts:33` | `"subscribe signature returns string (compile-time)"` — misleading; it's an assignment test, not a compile-time check. | Clarify: `"subscribe type signature accepts topic and handler returning string"`. |
| **SUGGESTION** | `src/managers/observability/__tests__/ports.test.ts:164` | `"Span.setStatus() is callable"` — verifies no-throw, but doesn't convey WHAT status values are valid. | Rename: `"Span.setStatus() accepts OK and ERROR without throwing"`. |
| **SUGGESTION** | `src/managers/config/__tests__/env.adapter.test.ts:143` | `"start() calls process.loadEnvFile() instead of dotenv"` — references implementation detail (dotenv → loadEnvFile migration). | Rename to behavior: `"start() loads environment from .env file"`. |

---

## Summary of Findings by Severity

### BLOCKER (3)
1. **No CI pipeline** — `.github/workflows/` is empty. Coverage thresholds, linting, and formatting are configured but never enforced.
2. **No `forbidOnly` protection** — CI could pass with `test.only` skipping critical tests.
3. **Cache stampede not tested** — concurrent `getOrSet()` could invoke factory multiple times.
4. **OOM on full integration test** — `bootstrap.integration.test.ts` is `.skip`-only; CI would explode.

### CRITICAL (2)
5. **NATS dependency untested** — `@nats-io/nats-core` is a runtime dep with no adapter or test.
6. **Prisma dependency untested** — `@prisma/client` is a devDep with no adapter or test.

### WARNING (9)
7. Undici HTTP client dependency has no real adapter.
8. `opossum` circuit breaker has no real adapter test.
9. `i18next` dependency has no real adapter test.
10. Port tests for event-bus are compile-time-only, not behavioral.
11. Several integration tests share mutable state between test cases.
12. Circuit breaker tests use real timers (666ms total).
13. Event bus test uses fragile `setTimeout(50)` for async delivery.
14. 8 vitest config files with no CI orchestrator.
15. Diagnostic integration tests (`diag-*`) are construction-only, adding no behavioral coverage.

### SUGGESTION (6)
16. Token expiry untested for auth adapters.
17. No duplicate registration error test for bootstrap.
18. HealthCheckTimeoutError never exercised.
19. Test naming could improve for diagnostic and port tests.
20. Coverage run not feasible locally due to OOM.
21. Barrel export test structure could be documented.

---

## Relevant Files

| File | Role |
|------|------|
| `vitest.config.ts` | Main test config — sets coverage thresholds, globals, timeouts |
| `vitest.integration.config.ts` | Integration-only config — fork pool, 30s timeout |
| `vitest.{dc,dh,dnh,deb,dob,ob}.config.ts` | Single-file diagnostic configs — no CI orchestrator |
| `eslint.config.js` | ESLint config — no test-specific rules (`@vitest/no-focused-tests`) |
| `package.json` | Scripts: `test`, `test:coverage`, `lint`, `format:check` — no `test:ci` |
| `src/managers/bootstrap/__tests__/bootstrap.integration.test.ts` | Full 19-manager integration — permanently skipped, OOM risk |
| `src/managers/cache/__tests__/memory.adapter.test.ts` | Excellent behavioral test example — but missing concurrent access test |
| `src/managers/circuit-breaker/__tests__/memory.adapter.test.ts` | Strong state machine coverage — but real timers slow it down |
| `src/managers/event-bus/__tests__/ports.test.ts` | Compile-time-only port tests — needs behavioral test implementation |
| `tests/e2e/e2e.test.ts` | E2E smoke test — fragile `setTimeout(50)` for async |
| `examples/blind_agent_demo.test.ts` | Full 19-manager demo — single test, fragile timeout, ~84ms |

---

## Key Learnings

- **Learned**: The test suite is structurally complete (every manager, every adapter has tests) but the CI pipeline is entirely absent, making coverage thresholds dead letter.
- **Learned**: Real adapter tests (S3, Redis, Drizzle, Jose, Pino) use proper mocking and are well-isolated — this pattern should extend to NATS, Prisma, undici, i18next, and opossum.
- **Learned**: The 19-manager bootstrap test OOMs even at 8GB heap. The split into 5 files works but the original file should be removed or gated.
- **Learned**: Circuit breaker tests use real `setTimeout(150)`, adding ~666ms to suite runtime. Fake timers would eliminate this entirely.
- **Learned**: No `test.only` usage found — good discipline. But no CI guard (`forbidOnly`) means a future PR could introduce one.
