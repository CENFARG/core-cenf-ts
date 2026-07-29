/**
 * Tests for HttpUpdateAdapter — HTTP-based update checker with signature verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HttpUpdateAdapter } from '../adapters/http.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig, UpdateArtifact } from '../types.js';
import { UpdateDownloadError } from '@cenf/core';
import { computeShasum } from '../helpers/crypto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    updateUrl: 'https://updates.example.com',
    publicKey: '3d4017c3e843895a92b70aa74d1d7f2d1d8e6b9a7d5c3f2e1a8b9c0d1e2f3a4b',
    currentVersion: '1.0.0',
    rollbackEnabled: true,
    ...overrides,
  };
}

/** Valid Ed25519 signature (64 bytes hex) for test artifacts. */
const MOCK_SIGNATURE = 'f'.repeat(128);

/** Invoke the fetch mock helper to generate a response. */
function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async arrayBuffer() { return Buffer.from(JSON.stringify(data)); },
  } as Response;
}

function binaryResponse(data: Buffer, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { throw new Error('not json'); },
    async arrayBuffer() {
      // Slice the underlying ArrayBuffer to avoid pooled-Buffer issues
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    },
  } as Response;
}

// ---------------------------------------------------------------------------
// HttpUpdateAdapter
// ---------------------------------------------------------------------------

describe('HttpUpdateAdapter', () => {
  let adapter: HttpUpdateAdapter;
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

  beforeEach(async () => {
    // Default mock returns 404 for all URLs
    fetchMock = async () =>
      jsonResponse({ error: 'not found' }, 404);
  });

  function createAdapter() {
    adapter = new HttpUpdateAdapter({
      config: makeConfig(),
      overridePlatform: 'macos',
      fetchFn: fetchMock,
    });
  }

  // -----------------------------------------------------------------------
  // checkForUpdates
  // -----------------------------------------------------------------------

  describe('checkForUpdates()', () => {
    it('returns null on 404 response', async () => {
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns null when no update is needed (same version)', async () => {
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/latest')) {
          return jsonResponse({
            version: '1.0.0',
            channel: 'stable',
            artifacts: [],
            release_notes_url: '',
          });
        }
        return jsonResponse({ error: 'not found' }, 404);
      };
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns an AvailableRelease when update is available', async () => {
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/latest')) {
          return jsonResponse({
            version: '2.0.0',
            channel: 'stable',
            artifacts: [{
              url: 'https://example.com/app-v2.dmg',
              platform: 'macos',
              arch: 'x64',
              kind: 'installer',
              hash: 'a'.repeat(64),
            }],
            release_notes_url: 'https://example.com/releases/v2',
          });
        }
        return jsonResponse({ error: 'not found' }, 404);
      };
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('2.0.0');
      expect(result!.artifacts).toHaveLength(1);
    });

    it('encodes the channel parameter in the URL', async () => {
      let requestedUrl = '';
      fetchMock = async (url: string | URL | Request) => {
        requestedUrl = typeof url === 'string' ? url : url.toString();
        return jsonResponse({
          version: '2.0.0',
          channel: 'beta',
          artifacts: [],
          release_notes_url: '',
        }, 200);
      };
      createAdapter();
      await adapter.checkForUpdates('myapp', Channel.Beta);
      expect(requestedUrl).toContain('channel=beta');
    });
  });

  // -----------------------------------------------------------------------
  // downloadUpdate
  // -----------------------------------------------------------------------

  describe('downloadUpdate()', () => {
    it('selects artifact matching platform and downloads it', async () => {
      const artifactData = Buffer.from('mock-artifact-binary');
      const expectedHash = computeShasum(artifactData);
      const artifactJson = {
        url: 'https://example.com/app-v2.dmg',
        platform: 'macos',
        arch: 'x64',
        kind: 'installer',
        hash: expectedHash,
      };

      fetchMock = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/app-v2.dmg')) {
          return binaryResponse(artifactData);
        }
        return jsonResponse({
          version: '2.0.0',
          channel: 'stable',
          artifacts: [artifactJson],
          release_notes_url: '',
        });
      };
      createAdapter();

      const release = await adapter.checkForUpdates('myapp');
      expect(release).not.toBeNull();
      const artifact = await adapter.downloadUpdate('myapp', release!);
      expect(artifact.url).toContain('app-v2.dmg');
      expect(artifact.hash).toBe(expectedHash);
    });

    it('throws UpdateDownloadError when no artifact matches platform', async () => {
      fetchMock = async () =>
        jsonResponse({
          version: '2.0.0',
          channel: 'stable',
          artifacts: [{
            url: 'https://example.com/app-v2.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            hash: 'a'.repeat(64),
          }],
          release_notes_url: '',
        });
      createAdapter();

      const release = await adapter.checkForUpdates('myapp');
      expect(release).not.toBeNull();
      await expect(
        adapter.downloadUpdate('myapp', release!),
      ).rejects.toThrow(UpdateDownloadError);
    });

    it('throws UpdateDownloadError when download fails', async () => {
      const artifactJson = {
        url: 'https://example.com/app-v2.dmg',
        platform: 'macos',
        arch: 'x64',
        kind: 'installer',
        hash: 'a'.repeat(64),
      };

      // Only the download URL fails
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/app-v2.dmg')) {
          return jsonResponse({ error: 'not found' }, 404);
        }
        return jsonResponse({
          version: '2.0.0',
          channel: 'stable',
          artifacts: [artifactJson],
          release_notes_url: '',
        });
      };
      createAdapter();

      const release = await adapter.checkForUpdates('myapp');
      expect(release).not.toBeNull();
      await expect(
        adapter.downloadUpdate('myapp', release!),
      ).rejects.toThrow(UpdateDownloadError);
    });
  });

  // -----------------------------------------------------------------------
  // applyUpdate / rollback
  // -----------------------------------------------------------------------

  describe('applyUpdate() and rollback()', () => {
    it('applyUpdate throws UpdateApplyError (platform-specific)', async () => {
      createAdapter();
      const artifact: UpdateArtifact = {
        url: 'https://example.com/pkg.dmg',
        platform: 'macos',
        arch: 'x64',
        kind: 'installer',
        hash: 'b'.repeat(64),
      };
      await expect(
        adapter.applyUpdate('myapp', artifact),
      ).rejects.toThrow('not supported');
    });

    it('rollback throws UpdateRollbackError (platform-specific)', async () => {
      createAdapter();
      await expect(
        adapter.rollback('myapp'),
      ).rejects.toThrow('not supported');
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() and stop() work', async () => {
      createAdapter();
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      await adapter.stop();
    });

    it('health() reports config', async () => {
      createAdapter();
      await adapter.start();
      const h = await adapter.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('updateUrl');
      expect(h.details).toHaveProperty('platform');
    });
  });
});
