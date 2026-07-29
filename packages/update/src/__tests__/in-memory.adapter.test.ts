/**
 * Tests for InMemoryUpdateAdapter — dict-backed test double.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryUpdateAdapter } from '../adapters/in-memory.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig, AvailableRelease, UpdateArtifact, UpdateResult } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    updateUrl: 'https://updates.example.com',
    publicKey: 'deadbeef',
    currentVersion: '1.0.0',
    rollbackEnabled: true,
    ...overrides,
  };
}

function makeArtifact(overrides?: Partial<UpdateArtifact>): UpdateArtifact {
  return {
    url: 'https://example.com/app-v2.dmg',
    platform: 'macos',
    arch: 'x64',
    kind: 'installer',
    hash: 'a'.repeat(64),
    ...overrides,
  };
}

function makeRelease(version: string, channel: Channel, artifacts: UpdateArtifact[]): AvailableRelease {
  return {
    version,
    channel,
    artifacts,
    metadata: {},
  };
}

// ---------------------------------------------------------------------------
// InMemoryUpdateAdapter
// ---------------------------------------------------------------------------

describe('InMemoryUpdateAdapter', () => {
  let adapter: InMemoryUpdateAdapter;

  beforeEach(async () => {
    adapter = new InMemoryUpdateAdapter({ config: makeConfig(), overridePlatform: 'macos' });
    await adapter.start();
  });

  // -----------------------------------------------------------------------
  // getCurrentVersion
  // -----------------------------------------------------------------------

  describe('getCurrentVersion()', () => {
    it('returns config default for unknown app', async () => {
      const v = await adapter.getCurrentVersion('unknown');
      expect(v).toBe('1.0.0');
    });

    it('returns updated version after apply', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      const release = await adapter.checkForUpdates('myapp');
      expect(release).not.toBeNull();
      const downloaded = await adapter.downloadUpdate('myapp', release!);
      await adapter.applyUpdate('myapp', downloaded);
      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('2.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // checkForUpdates
  // -----------------------------------------------------------------------

  describe('checkForUpdates()', () => {
    it('returns null when no releases configured', async () => {
      const r = await adapter.checkForUpdates('myapp');
      expect(r).toBeNull();
    });

    it('returns release when update is available', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      const r = await adapter.checkForUpdates('myapp');
      expect(r).not.toBeNull();
      expect(r!.version).toBe('2.0.0');
    });

    it('returns null when current version equals release version', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('1.0.0', Channel.Stable, [artifact]));
      const r = await adapter.checkForUpdates('myapp');
      expect(r).toBeNull();
    });

    it('returns null when current version is higher than release', async () => {
      const artifact = makeArtifact();
      adapter = new InMemoryUpdateAdapter({
        config: makeConfig({ currentVersion: '2.0.0' }),
        overridePlatform: 'macos',
      });
      await adapter.start();
      adapter.addRelease(Channel.Stable, makeRelease('1.5.0', Channel.Stable, [artifact]));
      const r = await adapter.checkForUpdates('myapp');
      expect(r).toBeNull();
    });

    it('respects channel parameter', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Beta, makeRelease('3.0.0-beta', Channel.Beta, [artifact]));
      // No stable release
      const r = await adapter.checkForUpdates('myapp', Channel.Stable);
      expect(r).toBeNull();
      // Beta release should be found
      const r2 = await adapter.checkForUpdates('myapp', Channel.Beta);
      expect(r2).not.toBeNull();
      expect(r2!.version).toBe('3.0.0-beta');
    });
  });

  // -----------------------------------------------------------------------
  // downloadUpdate
  // -----------------------------------------------------------------------

  describe('downloadUpdate()', () => {
    it('selects artifact matching platform', async () => {
      const macArtifact = makeArtifact({ platform: 'macos', url: 'https://example.com/mac.dmg' });
      const winArtifact = makeArtifact({ platform: 'windows', url: 'https://example.com/win.exe' });
      const release = makeRelease('2.0.0', Channel.Stable, [winArtifact, macArtifact]);
      adapter.addRelease(Channel.Stable, release);

      const downloaded = await adapter.checkForUpdates('myapp');
      expect(downloaded).not.toBeNull();
      const artifact = await adapter.downloadUpdate('myapp', downloaded!);
      expect(artifact.url).toContain('mac.dmg');
    });

    it('throws UpdateDownloadError when no artifact matches platform', async () => {
      const winArtifact = makeArtifact({ platform: 'windows', url: 'https://example.com/win.exe' });
      const release = makeRelease('2.0.0', Channel.Stable, [winArtifact]);
      adapter.addRelease(Channel.Stable, release);

      const downloaded = await adapter.checkForUpdates('myapp');
      expect(downloaded).not.toBeNull();
      await expect(adapter.downloadUpdate('myapp', downloaded!)).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // applyUpdate
  // -----------------------------------------------------------------------

  describe('applyUpdate()', () => {
    it('applies update and returns success with new version', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      const release = await adapter.checkForUpdates('myapp');
      const dl = await adapter.downloadUpdate('myapp', release!);
      const result = await adapter.applyUpdate('myapp', dl);
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('2.0.0');
    });

    it('saves rollback state before applying', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      const release = await adapter.checkForUpdates('myapp');
      const dl = await adapter.downloadUpdate('myapp', release!);
      await adapter.applyUpdate('myapp', dl);

      // Rollback should restore 1.0.0
      const rbResult = await adapter.rollback('myapp');
      expect(rbResult.success).toBe(true);
      expect(rbResult.newVersion).toBe('1.0.0');
    });

    it('auto-rollbacks on failure when rollback is enabled', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      adapter.setFailNextApply(true);
      const release = await adapter.checkForUpdates('myapp');
      const dl = await adapter.downloadUpdate('myapp', release!);
      const result = await adapter.applyUpdate('myapp', dl);
      expect(result.success).toBe(false);
      // Version should be restored to original
      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // rollback
  // -----------------------------------------------------------------------

  describe('rollback()', () => {
    it('throws UpdateRollbackError when no rollback state exists', async () => {
      await expect(adapter.rollback('myapp')).rejects.toThrow();
    });

    it('restores previous version after apply', async () => {
      const artifact = makeArtifact();
      adapter.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      const release = await adapter.checkForUpdates('myapp');
      const dl = await adapter.downloadUpdate('myapp', release!);
      await adapter.applyUpdate('myapp', dl);

      const rbResult = await adapter.rollback('myapp');
      expect(rbResult.success).toBe(true);
      expect(rbResult.newVersion).toBe('1.0.0');
      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() initializes clean state', async () => {
      const fresh = new InMemoryUpdateAdapter({ config: makeConfig(), overridePlatform: 'macos' });
      await fresh.start();
      const h = await fresh.health();
      expect(h.status).toBe('healthy');
      await fresh.stop();
    });

    it('stop() clears state', async () => {
      const fresh = new InMemoryUpdateAdapter({ config: makeConfig(), overridePlatform: 'macos' });
      await fresh.start();
      const artifact = makeArtifact();
      fresh.addRelease(Channel.Stable, makeRelease('2.0.0', Channel.Stable, [artifact]));
      await fresh.stop();
      const h = await fresh.health();
      expect(h.status).toBe('healthy');
    });

    it('health() reports version and config', async () => {
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('currentVersion', '1.0.0');
      expect(h.details).toHaveProperty('updateUrl');
    });
  });
});
