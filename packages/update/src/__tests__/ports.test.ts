/**
 * Contract verification tests for the UpdateManager port.
 *
 * Ensures the interface compiles correctly and documents the expected
 * contract via a test implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  UPDATE_PORT_VERSION,
  type UpdateManager,
} from '../ports.js';
import { Channel } from '../types.js';
import type { AvailableRelease, UpdateArtifact, UpdateResult } from '../types.js';
import type { AsyncLifecycle, HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of UpdateManager for contract verification
// ---------------------------------------------------------------------------

class TestUpdateManager implements UpdateManager {
  private _currentVersion = '1.0.0';

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async getCurrentVersion(appId: string): Promise<string> {
    return this._currentVersion;
  }

  async checkForUpdates(
    _appId: string,
    _channel?: Channel,
  ): Promise<AvailableRelease | null> {
    return null;
  }

  async downloadUpdate(
    _appId: string,
    _release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    return {
      url: 'https://example.com/app-v2.dmg',
      platform: 'macos',
      arch: 'x64',
      kind: 'installer',
      hash: 'a'.repeat(64),
    };
  }

  async applyUpdate(
    _appId: string,
    _artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    return { success: true, newVersion: '2.0.0' };
  }

  async rollback(_appId: string): Promise<UpdateResult> {
    return { success: true, newVersion: '1.0.0' };
  }
}

// ---------------------------------------------------------------------------
// UpdateManager port contract
// ---------------------------------------------------------------------------

describe('UpdateManager port', () => {
  it('exports a runtime version constant', () => {
    expect(UPDATE_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: UpdateManager = new TestUpdateManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestUpdateManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('getCurrentVersion() returns the installed version', async () => {
    const mgr = new TestUpdateManager();
    const v = await mgr.getCurrentVersion('test-app');
    expect(v).toBe('1.0.0');
  });

  it('checkForUpdates() returns null when no update available', async () => {
    const mgr = new TestUpdateManager();
    const release = await mgr.checkForUpdates('test-app');
    expect(release).toBeNull();
  });

  it('checkForUpdates() accepts optional channel parameter', async () => {
    const mgr = new TestUpdateManager();
    const release = await mgr.checkForUpdates('test-app', Channel.Beta);
    expect(release).toBeNull();
  });

  it('downloadUpdate() returns a verified artifact', async () => {
    const mgr = new TestUpdateManager();
    const release: AvailableRelease = {
      version: '2.0.0',
      channel: Channel.Stable,
      artifacts: [],
      metadata: {},
    };
    const artifact = await mgr.downloadUpdate('test-app', release);
    expect(artifact.url).toBeDefined();
    expect(artifact.hash).toHaveLength(64);
  });

  it('applyUpdate() returns a success result', async () => {
    const mgr = new TestUpdateManager();
    const artifact: UpdateArtifact = {
      url: 'https://example.com/pkg.dmg',
      platform: 'macos',
      arch: 'x64',
      kind: 'installer',
      hash: 'b'.repeat(64),
    };
    const result = await mgr.applyUpdate('test-app', artifact);
    expect(result.success).toBe(true);
    expect(result.newVersion).toBe('2.0.0');
  });

  it('rollback() returns a success result', async () => {
    const mgr = new TestUpdateManager();
    const result = await mgr.rollback('test-app');
    expect(result.success).toBe(true);
    expect(result.newVersion).toBe('1.0.0');
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestUpdateManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});
