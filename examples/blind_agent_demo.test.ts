/**
 * Blind Agent Demo — all 19 core-cenf-ts managers working together.
 *
 * Full integration demo built from scratch by an agent with ZERO prior
 * knowledge of core-cenf-ts, using only AGENTS.md and the barrel exports.
 *
 * Demonstrates every CENF manager with in-memory adapters and the
 * StandardBootstrapAdapter lifecycle pattern. No external I/O, no
 * network, no filesystem.
 *
 * Run: npx vitest run examples/blind_agent_demo.test.ts
 * Exit code 0 means all 19 managers boot successfully.
 *
 * @module examples/blind_agent_demo.test
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// M01 — ConfigManager (root, zero dependencies)
// ---------------------------------------------------------------------------
import { MemoryConfigAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M02 — LogManager (depends on: ConfigManager)
// ---------------------------------------------------------------------------
import { MemoryLogAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M03 — SecretManager (depends on: ConfigManager, LogManager)
// ---------------------------------------------------------------------------
import { MemorySecretAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M04 — ErrorHandlingManager (depends on: LogManager, ObservabilityManager)
// ---------------------------------------------------------------------------
import { StandardErrorHandlingAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M05 — ObservabilityManager (depends on: ConfigManager)
// ---------------------------------------------------------------------------
import { NoopObservabilityAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M06 — ValidationManager (depends on: none)
// ---------------------------------------------------------------------------
import { ZodValidationAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M07 — AuthManager (depends on: Config, Secret, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryAuthAdapter } from '../src/index.js';
import type { TokenConfig, JwtPayload } from '../src/index.js';

// ---------------------------------------------------------------------------
// M08 — CacheManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryCacheAdapter } from '../src/index.js';
import type { MemoryCacheOptions } from '../src/index.js';

// ---------------------------------------------------------------------------
// M09 — FeatureFlagManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryFeatureFlagAdapter } from '../src/index.js';
import type { FlagConfig } from '../src/index.js';

// ---------------------------------------------------------------------------
// M10 — RateLimiterManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryRateLimiterAdapter } from '../src/index.js';
import type { RateLimitConfig } from '../src/index.js';

// ---------------------------------------------------------------------------
// M11 — DatabaseManager (depends on: Config, Secret, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryDatabaseAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M12 — StorageManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryStorageAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M13 — HttpClientManager (depends on: Config, Log, Observability, Auth)
// ---------------------------------------------------------------------------
import { FetchHttpClientAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M14 — CircuitBreakerManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryCircuitBreakerAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M15 — EventBusManager (depends on: Config, Log, Observability)
// ---------------------------------------------------------------------------
import { MemoryEventBusAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M16 — I18nManager (depends on: Config, Log)
// ---------------------------------------------------------------------------
import { MemoryI18nAdapter } from '../src/index.js';
import type { I18nOptions } from '../src/index.js';

// ---------------------------------------------------------------------------
// M17 — JsonSerializer (depends on: none)
// ---------------------------------------------------------------------------
import { NativeJsonSerializer } from '../src/index.js';

// ---------------------------------------------------------------------------
// M18 — HealthManager (depends on: all other managers)
// ---------------------------------------------------------------------------
import { AggregatedHealthCheckAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// M19 — BootstrapOrchestrator (lifecycle management)
// ---------------------------------------------------------------------------
import { StandardBootstrapAdapter } from '../src/index.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
import type { HealthStatus } from '../src/index.js';

describe('Blind Agent Demo — 19 managers', () => {
  it('bootstraps all 19 managers in dependency order with zero external services', async () => {
    // ===================================================================
    // M01 — CONFIG MANAGER (root, zero deps)
    // ===================================================================
    const config = new MemoryConfigAdapter({
      NODE_ENV: 'test',
      CENF_ENV: 'test',
      APP_NAME: 'blind-agent-demo',
    });

    // ===================================================================
    // M02 — LOGGER MANAGER (depends on: Config)
    // ===================================================================
    const logger = new MemoryLogAdapter({
      service: 'blind-agent-demo',
      env: 'test',
    });

    // ===================================================================
    // M03 — SECRET MANAGER (depends on: Config, Log)
    // ===================================================================
    const secret = new MemorySecretAdapter();

    // ===================================================================
    // M04 — ERROR HANDLING MANAGER (depends on: Log, Observability)
    // ===================================================================
    const errorHandler = new StandardErrorHandlingAdapter();

    // ===================================================================
    // M05 — OBSERVABILITY MANAGER (depends on: Config)
    // ===================================================================
    const observability = new NoopObservabilityAdapter();

    // ===================================================================
    // M06 — VALIDATION MANAGER (depends on: none)
    // ===================================================================
    const validation = new ZodValidationAdapter();

    // ===================================================================
    // M07 — AUTH MANAGER (depends on: Config, Secret, Log, Observability)
    // ===================================================================
    const authConfig: TokenConfig = {
      secret: 'blind-agent-demo-hs256-secret-key-32chars!',
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'blind-agent-demo',
      audience: 'blind-agent-demo',
    };
    const auth = new MemoryAuthAdapter(authConfig);

    // ===================================================================
    // M08 — CACHE MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const cacheOptions: MemoryCacheOptions = { defaultTtlMs: 300_000 };
    const cache = new MemoryCacheAdapter(cacheOptions);

    // ===================================================================
    // M09 — FEATURE FLAG MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const flagConfig: FlagConfig = {
      flags: [
        { name: 'demo-feature', enabled: true },
        { name: 'beta-feature', enabled: false },
      ],
      defaultEnabled: false,
    };
    const featureFlags = new MemoryFeatureFlagAdapter(flagConfig);

    // ===================================================================
    // M10 — RATE LIMITER MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const rateLimitConfig: RateLimitConfig = {
      capacity: 100,
      refillRate: 10,
      refillInterval: 1_000,
    };
    const rateLimiter = new MemoryRateLimiterAdapter(rateLimitConfig);

    // ===================================================================
    // M11 — DATABASE MANAGER (depends on: Config, Secret, Log, Observability)
    // ===================================================================
    const database = new MemoryDatabaseAdapter();

    // ===================================================================
    // M12 — STORAGE MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const storage = new MemoryStorageAdapter();

    // ===================================================================
    // M13 — HTTP CLIENT MANAGER (depends on: Config, Log, Observability, Auth)
    // ===================================================================
    const httpClient = new FetchHttpClientAdapter();

    // ===================================================================
    // M14 — CIRCUIT BREAKER MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const circuitBreaker = new MemoryCircuitBreakerAdapter();

    // ===================================================================
    // M15 — EVENT BUS MANAGER (depends on: Config, Log, Observability)
    // ===================================================================
    const eventBus = new MemoryEventBusAdapter();

    // ===================================================================
    // M16 — I18N MANAGER (depends on: Config, Log)
    // ===================================================================
    const i18nOptions: I18nOptions = {
      defaultLocale: 'en',
      fallbackLocale: 'en',
    };
    const i18n = new MemoryI18nAdapter(i18nOptions);

    // ===================================================================
    // M17 — JSON SERIALIZER (depends on: none)
    // ===================================================================
    const serializer = new NativeJsonSerializer();

    // ===================================================================
    // M18 — HEALTH MANAGER (depends on: all other managers)
    // ===================================================================
    const health = new AggregatedHealthCheckAdapter();

    // ===================================================================
    // M19 — BOOTSTRAP ORCHESTRATOR (lifecycle management)
    // ===================================================================
    const bootstrap = new StandardBootstrapAdapter();

    // ===================================================================
    // REGISTER ALL MANAGERS IN DEPENDENCY ORDER
    // ===================================================================
    bootstrap.register(config, { name: 'ConfigManager', priority: 1 });
    bootstrap.register(logger, { name: 'LogManager', priority: 2 });
    bootstrap.register(secret, { name: 'SecretManager', priority: 3 });
    bootstrap.register(errorHandler, { name: 'ErrorHandlingManager', priority: 4 });
    bootstrap.register(observability, { name: 'ObservabilityManager', priority: 5 });
    bootstrap.register(validation, { name: 'ValidationManager', priority: 6 });
    bootstrap.register(auth, { name: 'AuthManager', priority: 7 });
    bootstrap.register(cache, { name: 'CacheManager', priority: 8 });
    bootstrap.register(featureFlags, { name: 'FeatureFlagManager', priority: 9 });
    bootstrap.register(rateLimiter, { name: 'RateLimiterManager', priority: 10 });
    bootstrap.register(database, { name: 'DatabaseManager', priority: 11 });
    bootstrap.register(storage, { name: 'StorageManager', priority: 12 });
    bootstrap.register(httpClient, { name: 'HttpClientManager', priority: 13 });
    bootstrap.register(circuitBreaker, { name: 'CircuitBreakerManager', priority: 14 });
    bootstrap.register(eventBus, { name: 'EventBusManager', priority: 15 });
    bootstrap.register(i18n, { name: 'I18nManager', priority: 16 });
    bootstrap.register(serializer, { name: 'JsonSerializer', priority: 17 });
    bootstrap.register(health, { name: 'HealthManager', priority: 18 });

    // Also register all health-checkable managers with the health aggregator
    health.register(config, 'ConfigManager');
    health.register(logger, 'LogManager');
    health.register(secret, 'SecretManager');
    health.register(errorHandler, 'ErrorHandlingManager');
    health.register(observability, 'ObservabilityManager');
    health.register(validation, 'ValidationManager');
    health.register(auth, 'AuthManager');
    health.register(cache, 'CacheManager');
    health.register(featureFlags, 'FeatureFlagManager');
    health.register(rateLimiter, 'RateLimiterManager');
    health.register(database, 'DatabaseManager');
    health.register(storage, 'StorageManager');
    health.register(httpClient, 'HttpClientManager');
    health.register(circuitBreaker, 'CircuitBreakerManager');
    health.register(eventBus, 'EventBusManager');
    health.register(i18n, 'I18nManager');
    health.register(serializer, 'JsonSerializer');
    health.register(bootstrap, 'BootstrapOrchestrator');

    // ===================================================================
    // START ALL MANAGERS via orchestrator
    // ===================================================================
    await bootstrap.start();

    // ===================================================================
    // VERIFY ORCHESTRATOR REPORTS HEALTHY
    // ===================================================================
    const bootstrapHealth: HealthStatus = await bootstrap.health();
    expect(bootstrapHealth.status).toBe('healthy');

    // ===================================================================
    // PER-MANAGER ASSERTIONS (TASK_027 — GREEN)
    // ===================================================================

    // --- M01: ConfigManager ---
    const nodeEnv = config.get<string>('NODE_ENV');
    expect(nodeEnv).toBe('test');
    const configHealth = await config.health();
    expect(configHealth.status).toBe('healthy');

    // --- M02: LogManager ---
    logger.info('Blind agent demo started');
    logger.info('Config loaded', { keys: 4 });
    expect(logger.entries.length).toBeGreaterThanOrEqual(2);
    const loggerHealth = await logger.health();
    expect(loggerHealth.status).toBe('healthy');

    // --- M03: SecretManager ---
    secret.set('demo-api-key', 'sk-demo-secret-12345');
    const apiKey = await secret.get('demo-api-key');
    expect(apiKey).toBe('sk-demo-secret-12345');

    // --- M04: ErrorHandlingManager ---
    const testError = new Error('Simulated transient failure');
    const classification = errorHandler.classify(testError);
    expect(classification).toBeDefined();
    expect(classification.category).toBeDefined();
    const errorReport = errorHandler.handle(testError, { source: 'demo' });
    expect(errorReport).toBeDefined();

    // --- M05: ObservabilityManager ---
    const span = observability.createSpan('demo.operation');
    expect(span).toBeDefined();
    expect(span.context).toBeDefined();
    expect(span.context.traceId).toBeDefined();
    span.end();

    // --- M06: ValidationManager ---
    const nameSchema = z.string().min(1);
    const validResult = validation.validate(nameSchema, 'hello');
    expect(validResult.ok).toBe(true);
    if (validResult.ok) {
      expect(validResult.value).toBe('hello');
    }

    // --- M07: AuthManager ---
    const payload: JwtPayload = {
      sub: 'blind-agent',
      role: 'demo',
    };
    const token = await auth.sign(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    const verified = await auth.verify(token);
    expect(verified.sub).toBe('blind-agent');

    // --- M08: CacheManager ---
    await cache.set('key:demo', { msg: 'hello from cache' });
    const cached = await cache.get<{ msg: string }>('key:demo');
    expect(cached).not.toBeNull();
    expect(cached!.msg).toBe('hello from cache');
    const hasKey = await cache.has('key:demo');
    expect(hasKey).toBe(true);

    // --- M09: FeatureFlagManager ---
    const isDemoEnabled = await featureFlags.isEnabled('demo-feature');
    expect(isDemoEnabled).toBe(true);
    const isBetaEnabled = await featureFlags.isEnabled('beta-feature');
    expect(isBetaEnabled).toBe(false);
    const isUnknownEnabled = await featureFlags.isEnabled('nonexistent');
    expect(isUnknownEnabled).toBe(false); // defaultEnabled: false

    // --- M10: RateLimiterManager ---
    const consumeResult = await rateLimiter.consume('api:demo', 1);
    expect(consumeResult.allowed).toBe(true);

    // --- M11: DatabaseManager ---
    await database.start();
    const queryResult = await database.query<{ val: number }>('SELECT 1 as val');
    expect(queryResult).toBeDefined();
    expect(queryResult.rows).toBeDefined();
    if (queryResult.rows && queryResult.rows.length > 0) {
      expect(queryResult.rows[0]!.val).toBe(1);
    }

    // --- M12: StorageManager ---
    await storage.start();
    await storage.put('demo/test.txt', Buffer.from('Hello Storage!'));
    const stored = await storage.get('demo/test.txt');
    expect(stored).not.toBeNull();
    expect(stored!.data).toEqual(Buffer.from('Hello Storage!'));
    const exists = await storage.exists('demo/test.txt');
    expect(exists).toBe(true);

    // --- M13: HttpClientManager ---
    httpClient.register('GET', '/api/status', {
      status: 200,
      data: { ok: true },
      headers: { 'content-type': 'application/json' },
    });
    const httpResponse = await httpClient.get<{ ok: boolean }>('/api/status');
    expect(httpResponse.status).toBe(200);
    expect(httpResponse.data.ok).toBe(true);

    // --- M14: CircuitBreakerManager ---
    const cbResult = await circuitBreaker.execute(async () => 'cb-ok');
    expect(cbResult).toBe('cb-ok');

    // --- M15: EventBusManager ---
    const receivedMessages: unknown[] = [];
    const subId = await eventBus.subscribe<string>('demo.topic', async (data) => {
      receivedMessages.push(data);
    });
    await eventBus.publish('demo.topic', { event: 'test', value: 42 });
    // Allow async handler to execute
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(receivedMessages.length).toBeGreaterThanOrEqual(1);
    await eventBus.unsubscribe(subId);

    // --- M16: I18nManager ---
    await i18n.loadResources('en', {
      'greeting': 'Hello, {{name}}!',
      'farewell': 'Goodbye!',
    });
    const greeting = i18n.t('greeting', { name: 'World' });
    expect(greeting).toBe('Hello, World!');
    const farewell = i18n.t('farewell');
    expect(farewell).toBe('Goodbye!');

    // --- M17: JsonSerializer ---
    const serialized = serializer.serialize({ id: 1, name: 'demo' });
    expect(typeof serialized).toBe('string');
    const deserialized = serializer.deserialize<{ id: number; name: string }>(serialized);
    expect(deserialized.id).toBe(1);
    expect(deserialized.name).toBe('demo');

    // --- M18: HealthManager ---
    const healthReport = await health.check();
    expect(healthReport.status).toBe('healthy');
    // 18 managers registered with health aggregator
    const componentCount = Object.keys(healthReport.components).length;
    expect(componentCount).toBeGreaterThanOrEqual(18);

    // --- Bonus: BootstrapOrchestrator ---
    // Prove all 19 managers registered
    const bootstrapFinalHealth: HealthStatus = await bootstrap.health();
    expect(bootstrapFinalHealth.status).toBe('healthy');
    const registeredManagers = (bootstrapFinalHealth.details as Record<string, unknown>)
      .registeredManagers as Array<{ name: string }>;
    expect(registeredManagers.length).toBe(18); // 18 registered + Bootstrap itself = 19 total

    // ===================================================================
    // STOP ALL MANAGERS via orchestrator (reverse order)
    // ===================================================================
    await bootstrap.stop();

    // Verify orchestrator reports not started after stop
    const afterStopHealth: HealthStatus = await bootstrap.health();
    expect(afterStopHealth.status).toBe('degraded');
  });
});
