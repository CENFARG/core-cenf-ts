import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryFeatureFlagAdapter } from '../adapters/memory.adapter.js';
import type { FeatureFlagManager } from '../ports.js';
import type { FlagConfig, FeatureFlag } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  flags: FeatureFlag[],
  defaultEnabled?: boolean,
): FlagConfig {
  return { flags, defaultEnabled };
}

// ---------------------------------------------------------------------------
// MemoryFeatureFlagAdapter
// ---------------------------------------------------------------------------

describe('MemoryFeatureFlagAdapter', () => {
  let manager: FeatureFlagManager;

  describe('with boolean flags only', () => {
    beforeEach(async () => {
      manager = new MemoryFeatureFlagAdapter(
        makeConfig([
          { name: 'newDashboard', enabled: true },
          { name: 'darkMode', enabled: false },
          { name: 'betaSearch', enabled: true, description: 'Beta search feature' },
        ]),
      );
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('isEnabled() returns true for enabled flag', async () => {
      expect(await manager.isEnabled('newDashboard')).toBe(true);
    });

    it('isEnabled() returns false for disabled flag', async () => {
      expect(await manager.isEnabled('darkMode')).toBe(false);
    });

    it('isEnabled() returns false for missing flag', async () => {
      expect(await manager.isEnabled('nonexistent')).toBe(false);
    });

    it('isEnabledForUser() returns true for enabled flag', async () => {
      expect(await manager.isEnabledForUser('newDashboard', 'user-1')).toBe(true);
    });

    it('isEnabledForUser() returns false for disabled flag', async () => {
      expect(await manager.isEnabledForUser('darkMode', 'user-99')).toBe(false);
    });

    it('getAllFlags() returns all configured flags', async () => {
      const flags = await manager.getAllFlags();
      expect(flags).toHaveLength(3);
      const names = flags.map((f) => f.name).sort();
      expect(names).toEqual(['betaSearch', 'darkMode', 'newDashboard']);
    });
  });

  // -----------------------------------------------------------------------
  // Percentage rollout
  // -----------------------------------------------------------------------

  describe('with percentage rollout flags', () => {
    beforeEach(async () => {
      manager = new MemoryFeatureFlagAdapter(
        makeConfig([
          {
            name: 'betaFeature',
            enabled: true,
            rolloutPercentage: 50,
          },
        ]),
      );
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('isEnabled() returns false for percentage flag (no user context)', async () => {
      // Without a userId, percentage rollout cannot be evaluated.
      expect(await manager.isEnabled('betaFeature')).toBe(false);
    });

    it('isEnabledForUser() is deterministic for the same userId', async () => {
      const result1 = await manager.isEnabledForUser('betaFeature', 'user-123');
      const result2 = await manager.isEnabledForUser('betaFeature', 'user-123');
      expect(result1).toBe(result2);
    });

    it('isEnabledForUser() distributes across users', async () => {
      const enabled: string[] = [];
      const disabled: string[] = [];
      for (let i = 0; i < 200; i++) {
        const userId = `user-${i}`;
        const allowed = await manager.isEnabledForUser('betaFeature', userId);
        if (allowed) enabled.push(userId);
        else disabled.push(userId);
      }
      // With 50% rollout and 200 users, expect between 30% and 70%
      const ratio = enabled.length / 200;
      expect(ratio).toBeGreaterThan(0.30);
      expect(ratio).toBeLessThan(0.70);
    });

    it('isEnabledForUser() with 100% rollout enables everyone', async () => {
      const fullCfg = makeConfig([
        { name: 'fullGA', enabled: true, rolloutPercentage: 100 },
      ]);
      const mgr = new MemoryFeatureFlagAdapter(fullCfg);
      await mgr.start();
      for (let i = 0; i < 50; i++) {
        expect(await mgr.isEnabledForUser('fullGA', `user-${i}`)).toBe(true);
      }
      await mgr.stop();
    });

    it('isEnabledForUser() with 0% rollout enables no one', async () => {
      const zeroCfg = makeConfig([
        { name: 'disabled', enabled: true, rolloutPercentage: 0 },
      ]);
      const mgr = new MemoryFeatureFlagAdapter(zeroCfg);
      await mgr.start();
      for (let i = 0; i < 50; i++) {
        expect(await mgr.isEnabledForUser('disabled', `user-${i}`)).toBe(false);
      }
      await mgr.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Default enabled
  // -----------------------------------------------------------------------

  describe('with defaultEnabled: true', () => {
    beforeEach(async () => {
      manager = new MemoryFeatureFlagAdapter(
        makeConfig(
          [{ name: 'knownFlag', enabled: true }],
          true, // defaultEnabled
        ),
      );
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('returns true for missing flag when defaultEnabled is true', async () => {
      expect(await manager.isEnabled('unknownFlag')).toBe(true);
    });

    it('returns true for known flag still', async () => {
      expect(await manager.isEnabled('knownFlag')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty config returns false for any flag', async () => {
      const mgr = new MemoryFeatureFlagAdapter(makeConfig([]));
      await mgr.start();
      expect(await mgr.isEnabled('anything')).toBe(false);
      expect(await mgr.getAllFlags()).toEqual([]);
      await mgr.stop();
    });

    it('getAllFlags() preserves flag properties', async () => {
      const config = makeConfig([
        {
          name: 'detailed',
          enabled: true,
          description: 'Detailed description here',
          rolloutPercentage: 25,
        },
      ]);
      const mgr = new MemoryFeatureFlagAdapter(config);
      await mgr.start();
      const flags = await mgr.getAllFlags();
      expect(flags[0]).toEqual(config.flags[0]);
      await mgr.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() initializes from config', async () => {
      const mgr = new MemoryFeatureFlagAdapter(
        makeConfig([{ name: 'test', enabled: true }]),
      );
      await mgr.start();
      expect(await mgr.isEnabled('test')).toBe(true);
      await mgr.stop();
    });

    it('health() reports adapter info', async () => {
      const mgr = new MemoryFeatureFlagAdapter(
        makeConfig([{ name: 'f1', enabled: true }, { name: 'f2', enabled: false }]),
      );
      await mgr.start();
      const h = await mgr.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('adapter', 'memory');
      expect(h.details).toHaveProperty('flagsLoaded');
      await mgr.stop();
    });
  });
});
