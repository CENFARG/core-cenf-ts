/**
 * Tests for PipUpdateAdapter — pip-based Python package updater.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PipUpdateAdapter } from '../adapters/pip.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig, UpdateArtifact, AvailableRelease } from '../types.js';
import { UpdateRollbackError } from '@cenf/core';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    updateUrl: 'https://pypi.example.com/simple',
    publicKey: 'deadbeef',
    currentVersion: '1.0.0',
    rollbackEnabled: true,
    ...overrides,
  };
}

function makeArtifact(overrides?: Partial<UpdateArtifact>): UpdateArtifact {
  return {
    url: 'https://pypi.example.com/packages/myapp-2.0.0.tar.gz',
    platform: 'linux',
    arch: 'x64',
    kind: 'archive',
    hash: 'a'.repeat(64),
    ...overrides,
  };
}

/** Temp directory for testing state files. */
let tmpDir: string;

// ---------------------------------------------------------------------------
// PipUpdateAdapter
// ---------------------------------------------------------------------------

describe('PipUpdateAdapter', () => {
  let adapter: PipUpdateAdapter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pip-test-'));
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('state file management', () => {
    it('creates update_state.json on first apply', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo', // no actual pip
      });
      await adapter.start();

      const artifact = makeArtifact();
      await adapter.applyUpdate('myapp', artifact);

      const statePath = join(tmpDir, 'update_state.json');
      expect(existsSync(statePath)).toBe(true);
      const state = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(state).toHaveProperty('myapp');
      expect(state.myapp.previousVersion).toBe('1.0.0');
    });

    it('reads existing state file on start', async () => {
      // Pre-create a state file
      const statePath = join(tmpDir, 'update_state.json');
      writeFileSync(statePath, JSON.stringify({
        myapp: { previousVersion: '0.9.0', previousHash: 'b'.repeat(64) },
      }));

      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0'); // from config (overrides state)
    });
  });

  describe('getCurrentVersion()', () => {
    it('returns config version by default', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0');
    });
  });

  describe('checkForUpdates()', () => {
    it('returns null when no releases configured', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      const r = await adapter.checkForUpdates('myapp');
      expect(r).toBeNull();
    });
  });

  describe('downloadUpdate()', () => {
    it('returns the artifact unchanged (pip handles download + verify)', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        overridePlatform: 'linux',
        pipCommand: 'echo',
      });
      await adapter.start();

      const release: AvailableRelease = {
        version: '2.0.0',
        channel: Channel.Stable,
        artifacts: [makeArtifact()],
        metadata: {},
      };

      const artifact = await adapter.downloadUpdate('myapp', release);
      expect(artifact.hash).toBe('a'.repeat(64));
    });

    it('selects artifact matching platform', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        overridePlatform: 'linux',
        pipCommand: 'echo',
      });
      await adapter.start();

      const linuxArtifact = makeArtifact({ platform: 'linux', url: 'https://example.com/linux.tar.gz' });
      const winArtifact = makeArtifact({ platform: 'windows', url: 'https://example.com/win.zip' });
      const release: AvailableRelease = {
        version: '2.0.0',
        channel: Channel.Stable,
        artifacts: [winArtifact, linuxArtifact],
        metadata: {},
      };

      const artifact = await adapter.downloadUpdate('myapp', release);
      expect(artifact.url).toContain('linux.tar.gz');
    });
  });

  describe('applyUpdate()', () => {
    it('returns success when pip command succeeds', async () => {
      // Use 'echo' as pip — it always succeeds
      adapter = new PipUpdateAdapter({
        config: makeConfig({ currentVersion: '1.0.0' }),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      const artifact = makeArtifact();
      const result = await adapter.applyUpdate('myapp', artifact);
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('2.0.0');
    });

    it('returns success with bumped version when no matching release', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig({ currentVersion: '1.0.0' }),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      // An artifact with a URL that doesn't match any stored release
      const artifact: UpdateArtifact = {
        url: 'https://unknown.example.com/pkg.tar.gz',
        platform: 'linux',
        arch: 'x64',
        kind: 'archive',
        hash: 'c'.repeat(64),
      };

      const result = await adapter.applyUpdate('myapp', artifact);
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('1.0.1');
    });
  });

  describe('rollback()', () => {
    it('restores previous version from state file', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig({ currentVersion: '1.0.0' }),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      const artifact = makeArtifact();
      await adapter.applyUpdate('myapp', artifact);
      const result = await adapter.rollback('myapp');
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('1.0.0');

      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0');
    });

    it('throws UpdateRollbackError when no state exists', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();

      await expect(adapter.rollback('myapp')).rejects.toThrow(UpdateRollbackError);
    });
  });

  describe('lifecycle', () => {
    it('start() and stop() work', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      await adapter.stop();
    });

    it('health() reports config', async () => {
      adapter = new PipUpdateAdapter({
        config: makeConfig(),
        stateDir: tmpDir,
        pipCommand: 'echo',
      });
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('stateDir');
      expect(h.details).toHaveProperty('pipCommand');
    });
  });
});
