/**
 * Tests for AndroidUpdateAdapter — Play Core + PackageInstaller adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AndroidUpdateAdapter } from '../adapters/android.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig, UpdateArtifact } from '../types.js';
import { UpdateApplyError, UpdateRollbackError, UpdateDownloadError } from '@cenf/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    updateUrl: 'https://play.googleapis.com',
    publicKey: 'deadbeef',
    currentVersion: '1.0.0',
    rollbackEnabled: true,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async arrayBuffer() { return Buffer.from(JSON.stringify(data)).buffer; },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// AndroidUpdateAdapter
// ---------------------------------------------------------------------------

describe('AndroidUpdateAdapter', () => {
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  let adapter: AndroidUpdateAdapter;

  function createAdapter(overrides?: Partial<UpdateConfig>) {
    adapter = new AndroidUpdateAdapter({
      config: makeConfig(overrides),
      fetchFn: fetchMock,
    });
  }

  // -----------------------------------------------------------------------
  // getCurrentVersion
  // -----------------------------------------------------------------------

  describe('getCurrentVersion()', () => {
    it('returns config version', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      const v = await adapter.getCurrentVersion('com.example.app');
      expect(v).toBe('1.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // checkForUpdates
  // -----------------------------------------------------------------------

  describe('checkForUpdates()', () => {
    it('returns null on 404', async () => {
      fetchMock = async () => jsonResponse({ error: 'not found' }, 404);
      createAdapter();
      const result = await adapter.checkForUpdates('com.example.app');
      expect(result).toBeNull();
    });

    it('returns null when current version is latest', async () => {
      fetchMock = async () => jsonResponse({
        versionCode: 2,
        versionName: '1.0.0',
        artifacts: [],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('com.example.app');
      expect(result).toBeNull();
    });

    it('returns AvailableRelease when update is available', async () => {
      fetchMock = async () => jsonResponse({
        versionCode: 3,
        versionName: '2.0.0',
        artifacts: [{
          url: 'https://play.googleapis.com/download/app.apk',
          platform: 'android',
          arch: 'arm64',
          kind: 'installer',
          hash: 'a'.repeat(64),
        }],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('com.example.app');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('2.0.0');
      expect(result!.artifacts).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // downloadUpdate
  // -----------------------------------------------------------------------

  describe('downloadUpdate()', () => {
    it('downloads and returns verified artifact', async () => {
      const mockBinary = Buffer.from('mock-apk-binary-data');
      const { computeShasum } = await import('../helpers/crypto.js');
      const expectedHash = computeShasum(mockBinary);

      fetchMock = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('download')) {
          return {
            ok: true,
            status: 200,
            async json() { throw new Error('not json'); },
            async arrayBuffer() {
              return mockBinary.buffer.slice(
                mockBinary.byteOffset,
                mockBinary.byteOffset + mockBinary.byteLength,
              );
            },
          } as unknown as Response;
        }
        return jsonResponse({
          versionCode: 3,
          versionName: '2.0.0',
          artifacts: [{
            url: 'https://play.googleapis.com/download/app.apk',
            platform: 'android',
            arch: 'arm64',
            kind: 'installer',
            hash: expectedHash,
          }],
        }, 200);
      };
      createAdapter();
      const release = await adapter.checkForUpdates('com.example.app');
      expect(release).not.toBeNull();
      const artifact = await adapter.downloadUpdate('com.example.app', release!);
      expect(artifact.platform).toBe('android');
      expect(artifact.kind).toBe('installer');
    });
  });

  // -----------------------------------------------------------------------
  // applyUpdate
  // -----------------------------------------------------------------------

  describe('applyUpdate()', () => {
    it('triggers apply and returns success with version from URL', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter({ currentVersion: '1.0.0' });
      const artifact: UpdateArtifact = {
        url: 'https://play.googleapis.com/download/app-2.0.0.apk',
        platform: 'android',
        arch: 'arm64',
        kind: 'installer',
        hash: 'b'.repeat(64),
      };
      const result = await adapter.applyUpdate('com.example.app', artifact);
      expect(result.success).toBe(true);
      expect(result.newVersion).toBe('2.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // rollback
  // -----------------------------------------------------------------------

  describe('rollback()', () => {
    it('throws UpdateRollbackError (Android does not support rollback)', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      await expect(adapter.rollback('com.example.app')).rejects.toThrow(UpdateRollbackError);
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() and stop() work', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      await adapter.stop();
    });

    it('health() reports config', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('updateUrl');
    });
  });
});
