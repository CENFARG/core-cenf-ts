# Integration Test Split Specification

## Purpose

Split the monolithic `bootstrap.integration.test.ts` into 3 concern-separated files to prevent OOM on the target machine. Configure vitest for pool-based isolation and disable coverage for integration tests.

## Requirements

### Requirement: Test File Separation by Concern

The system MUST split `bootstrap.integration.test.ts` into 3 files: `foundation.integration.test.ts` (Config, Logging, Error, Validation), `data.integration.test.ts` (Cache, Database, Storage, HttpClient), and `orchestration.integration.test.ts` (Bootstrap, Health, EventBus, I18n, FeatureFlag, RateLimiter, CircuitBreaker, Auth, Secret, Observability, JsonSerializer). Each file MUST import only the managers it tests.

#### Scenario: Foundation tests run independently

- GIVEN `foundation.integration.test.ts` is executed alone
- WHEN `npx vitest run foundation.integration.test.ts` is called
- THEN Config, Logging, Error, and Validation manager tests pass
- AND no managers from other concern groups are loaded

#### Scenario: Data tests run independently

- GIVEN `data.integration.test.ts` is executed alone
- WHEN `npx vitest run data.integration.test.ts` is called
- THEN Cache, Database, Storage, and HttpClient tests pass
- AND the file does not import foundation managers directly

#### Scenario: Orchestration tests run independently

- GIVEN `orchestration.integration.test.ts` is executed alone
- WHEN `npx vitest run orchestration.integration.test.ts` is called
- THEN Bootstrap, Health, and remaining manager tests pass
- AND no OOM occurs on the target machine

### Requirement: Vitest Pool Configuration for Integration Tests

The system MUST configure `vitest.config.ts` to use `pool: 'forks'` and `singleFork: true` for integration test files. Coverage MUST be disabled for integration test files to reduce memory overhead.

#### Scenario: Fork-based isolation for integration tests

- GIVEN `vitest.config.ts` has integration test project config
- WHEN integration tests are run via `npx vitest run --project integration`
- THEN each test file runs in its own forked process
- AND `singleFork: true` prevents parallel fork spawning

#### Scenario: Coverage disabled for integration tests

- GIVEN integration tests are configured in vitest
- WHEN `npx vitest run --coverage` is executed
- THEN coverage collection is skipped for `*.integration.test.ts` files
- AND coverage is only collected for unit test files

### Requirement: Lightweight E2E Smoke Test

The system MUST provide `e2e.test.ts` with exactly 5 core managers (Config, Logging, Cache, Database, Storage) as a fast smoke test. This file MUST NOT be an integration test — it uses memory adapters and completes in <10 seconds.

#### Scenario: E2E smoke test passes with memory adapters

- GIVEN all 5 core managers use memory/in-memory adapters
- WHEN `npx vitest run e2e.test.ts` is called
- THEN all 5 managers bootstrap successfully
- AND the test completes in under 10 seconds

#### Scenario: E2E test validates key methods

- GIVEN the 5 managers are bootstrapped
- WHEN the smoke test runs
- THEN it asserts: config.load(), logging.info(), cache.set/get, db.connect/query, storage.upload/download
- AND each assertion passes

#### Scenario: E2E test is excluded from integration pool

- GIVEN vitest project configuration
- WHEN integration tests run
- THEN `e2e.test.ts` is NOT included in the integration project
- AND it runs as part of the default unit test suite
