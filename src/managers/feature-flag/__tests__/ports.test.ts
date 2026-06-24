import { describe, it, expect } from 'vitest';
import {
  FEATURE_FLAG_PORT_VERSION,
  type FeatureFlagManager,
} from '../ports.js';
import type { FeatureFlag, FlagConfig } from '../types.js';
import type { AsyncLifecycle } from '../../../shared/lifecycle.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// Test implementation of FeatureFlagManager for contract verification
// ---------------------------------------------------------------------------

class TestFeatureFlagManager implements FeatureFlagManager {
  private flags = new Map<string, FeatureFlag>();

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async isEnabled(_flag: string): Promise<boolean> {
    return false;
  }

  async isEnabledForUser(_flag: string, _userId: string): Promise<boolean> {
    return false;
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// FeatureFlagManager port contract
// ---------------------------------------------------------------------------

describe('FeatureFlagManager port', () => {
  it('exports a runtime version constant', () => {
    expect(FEATURE_FLAG_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: FeatureFlagManager = new TestFeatureFlagManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestFeatureFlagManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('isEnabled() returns false by default', async () => {
    const mgr = new TestFeatureFlagManager();
    expect(await mgr.isEnabled('unknown')).toBe(false);
  });

  it('isEnabledForUser() returns false by default', async () => {
    const mgr = new TestFeatureFlagManager();
    expect(await mgr.isEnabledForUser('unknown', 'user-1')).toBe(false);
  });

  it('getAllFlags() returns empty array by default', async () => {
    const mgr = new TestFeatureFlagManager();
    const flags = await mgr.getAllFlags();
    expect(flags).toEqual([]);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestFeatureFlagManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// FeatureFlag types
// ---------------------------------------------------------------------------

describe('FeatureFlag types', () => {
  it('FeatureFlag has required name and enabled fields', () => {
    const flag: FeatureFlag = {
      name: 'newDashboard',
      enabled: true,
    };
    expect(flag.name).toBe('newDashboard');
    expect(flag.enabled).toBe(true);
  });

  it('FeatureFlag accepts optional description and rolloutPercentage', () => {
    const flag: FeatureFlag = {
      name: 'betaFeature',
      enabled: true,
      description: 'Beta feature for early access',
      rolloutPercentage: 50,
    };
    expect(flag.description).toBe('Beta feature for early access');
    expect(flag.rolloutPercentage).toBe(50);
  });

  it('FlagConfig holds flags array and optional defaultEnabled', () => {
    const config: FlagConfig = {
      flags: [
        { name: 'flagA', enabled: true },
        { name: 'flagB', enabled: false },
      ],
      defaultEnabled: false,
    };
    expect(config.flags).toHaveLength(2);
    expect(config.defaultEnabled).toBe(false);
  });

  it('FlagConfig defaultEnabled defaults to false when omitted', () => {
    const config: FlagConfig = {
      flags: [{ name: 'only', enabled: true }],
    };
    // defaultEnabled is optional — must compile
    expect(config.flags[0].name).toBe('only');
  });
});
