# Blind Agent E2E Specification

## Purpose

Create a dependency-ordered bootstrap test that imports all 19 managers with memory adapters, proving full composition works. Must pass with zero prior context — a new agent or developer can run it to verify the entire system boots.

## Requirements

### Requirement: All 19 Managers Imported and Bootstrapped

The system MUST import all 19 managers from the public API. The test MUST bootstrap them in dependency order: Config → Logging → Error → Validation → Secret → Observability → Auth → Cache → FeatureFlag → RateLimiter → Database → Storage → HttpClient → CircuitBreaker → EventBus → I18n → JsonSerializer → Health → Bootstrap.

#### Scenario: Full import without errors

- GIVEN the package is built (`npm run build`)
- WHEN `import { ... } from 'core-cenf-ts'` imports all 19 managers
- THEN no import errors occur
- AND all 19 manager types are available

#### Scenario: Dependency-ordered bootstrap completes

- GIVEN all managers are instantiated with memory adapters
- WHEN they are started in dependency order
- THEN each manager's `start()` resolves without error
- AND BootstrapOrchestrator reports all managers healthy

### Requirement: Key Method Assertions Per Manager

The system MUST assert at least one key method per manager to prove functional composition. Assertions MUST cover: config.load(), logging.info(), cache.set/get, db.query(), storage.upload(), httpClient.get(), circuitBreaker.execute(), eventBus.publish(), i18n.t(), serializer.serialize(), health.check().

#### Scenario: Config manager loads schema

- GIVEN a valid Zod schema for test config
- WHEN `await config.load(schema)` is called in the test
- THEN it returns a typed config object
- AND the assertion passes

#### Scenario: Cache manager stores and retrieves

- GIVEN cache manager is started with memory adapter
- WHEN `await cache.set("test", "value")` then `await cache.get("test")` is called
- THEN it returns `"value"`
- AND the assertion passes

#### Scenario: Database manager executes query

- GIVEN database manager is started with SQLite in-memory
- WHEN `await db.query("SELECT 1 as val")` is called
- THEN it returns `[{ val: 1 }]`
- AND the assertion passes

### Requirement: Zero Prior Context Execution

The test MUST pass when run in isolation with no prior test state, no external services, and no environment setup beyond a `.env` file with defaults. It MUST NOT require Redis, PostgreSQL, S3, or any external dependency.

#### Scenario: Clean environment execution

- GIVEN a fresh Node.js process with no prior state
- WHEN `npx vitest run blind_agent_demo.test.ts` is called
- THEN all assertions pass
- AND no external services are required

#### Scenario: Default environment variables sufficient

- GIVEN only `CENF_ENV=test` is set in the environment
- WHEN the test bootstraps all managers
- THEN all managers use sensible defaults
- AND no `ConfigNotFoundError` is thrown

### Requirement: Health Aggregation Across All Managers

The system MUST verify that HealthManager can aggregate health status from all 19 managers after bootstrap. The aggregate health MUST report all managers as healthy.

#### Scenario: Aggregate health check

- GIVEN all 19 managers are started
- WHEN `await health.check()` is called
- THEN it returns `{ status: 'healthy', details: { managers: 19, allHealthy: true } }`
- AND each manager's individual health is included in details

#### Scenario: BootstrapOrchestrator lifecycle

- GIVEN BootstrapOrchestrator is configured with all 19 managers
- WHEN `await orchestrator.start()` is called
- THEN all managers start in order
- AND `await orchestrator.stop()` shuts them down in reverse order
- AND no manager throws during stop
