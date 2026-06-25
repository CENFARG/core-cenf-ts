/**
 * Integration test: BootstrapOrchestrator with 5 ORCHESTRATION managers (Part A).
 *
 * Managers under test:
 * - Observability (NoopObservabilityAdapter)
 * - Auth (MemoryAuthAdapter)
 * - FeatureFlag (MemoryFeatureFlagAdapter)
 * - RateLimiter (MemoryRateLimiterAdapter)
 * - I18n (MemoryI18nAdapter)
 *
 * All adapters are in-memory — no external dependencies required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StandardBootstrapAdapter } from '../../src/managers/bootstrap/adapters/standard.adapter.js';
import { NoopObservabilityAdapter } from '../../src/managers/observability/adapters/noop.adapter.js';
import { MemoryAuthAdapter } from '../../src/managers/auth/adapters/memory.adapter.js';
import { MemoryFeatureFlagAdapter } from '../../src/managers/feature-flag/adapters/memory.adapter.js';
import { MemoryRateLimiterAdapter } from '../../src/managers/rate-limiter/adapters/memory.adapter.js';
import { MemoryI18nAdapter } from '../../src/managers/i18n/adapters/memory.adapter.js';

describe('BootstrapOrchestrator — Orchestration Managers A (5)', () => {
  let bootstrap: StandardBootstrapAdapter;
  let observability: NoopObservabilityAdapter;
  let auth: MemoryAuthAdapter;
  let featureFlag: MemoryFeatureFlagAdapter;
  let rateLimiter: MemoryRateLimiterAdapter;
  let i18n: MemoryI18nAdapter;

  beforeAll(async () => {
    bootstrap = new StandardBootstrapAdapter();

    observability = new NoopObservabilityAdapter();
    auth = new MemoryAuthAdapter({ secret: 'test-secret-orch-a' });
    featureFlag = new MemoryFeatureFlagAdapter({
      flags: [
        { name: 'beta-feature', enabled: true },
        { name: 'dark-mode', enabled: false },
      ],
      defaultEnabled: false,
    });
    rateLimiter = new MemoryRateLimiterAdapter({
      capacity: 100,
      refillRate: 10,
      refillInterval: 1000,
    });
    i18n = new MemoryI18nAdapter({ defaultLocale: 'en' });

    bootstrap.register(observability, { priority: 5, name: 'observability' });
    bootstrap.register(auth, { priority: 7, name: 'auth' });
    bootstrap.register(featureFlag, { priority: 9, name: 'featureFlag' });
    bootstrap.register(rateLimiter, { priority: 10, name: 'rateLimiter' });
    bootstrap.register(i18n, { priority: 16, name: 'i18n' });

    await bootstrap.start();
  });

  afterAll(async () => {
    await bootstrap.stop();
  });

  it('bootstrap reports healthy with 5 managers', async () => {
    const h = await bootstrap.health();
    expect(h.status).toBe('healthy');
  });

  // Auth
  it('auth.sign() creates a valid token', async () => {
    const token = await auth.sign({ sub: 'user-1', role: 'admin' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('auth.verify() returns payload for valid token', async () => {
    const token = await auth.sign({ sub: 'user-2', role: 'editor' });
    const payload = await auth.verify(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-2');
    expect(payload!.role).toBe('editor');
  });

  it('auth.verify() throws for garbage token', async () => {
    await expect(auth.verify('garbage.not-a-token.here')).rejects.toThrow();
  });

  // FeatureFlag
  it('featureFlag.isEnabled() returns true for enabled', async () => {
    expect(await featureFlag.isEnabled('beta-feature')).toBe(true);
  });

  it('featureFlag.isEnabled() returns false for disabled', async () => {
    expect(await featureFlag.isEnabled('dark-mode')).toBe(false);
  });

  it('featureFlag.isEnabled() returns default for unknown', async () => {
    expect(await featureFlag.isEnabled('nonexistent')).toBe(false);
  });

  // RateLimiter
  it('rateLimiter.consume() allows within capacity', async () => {
    const result = await rateLimiter.consume('test-key', 1);
    expect(result.allowed).toBe(true);
  });

  it('rateLimiter returns remaining tokens', async () => {
    const result = await rateLimiter.consume('key-2', 1);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  // I18n
  it('i18n.t() translates with params', async () => {
    await i18n.loadResources('en', { greeting: 'Hello, {{name}}!' });
    expect(i18n.t('greeting', { name: 'World' })).toBe('Hello, World!');
  });

  it('i18n.t() returns key when missing', () => {
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('i18n.getLocale() returns current locale', () => {
    expect(i18n.getLocale()).toBe('en');
  });

  // Health checks
  it('all managers report healthy', async () => {
    expect((await observability.health()).status).toBe('healthy');
    expect((await auth.health()).status).toBe('healthy');
    expect((await featureFlag.health()).status).toBe('healthy');
    expect((await rateLimiter.health()).status).toBe('healthy');
    expect((await i18n.health()).status).toBe('healthy');
  });
});
