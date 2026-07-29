/**
 * Tests for GitHubReleaseAdapter — GitHub Releases API adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubReleaseAdapter } from '../adapters/github-release.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig } from '../types.js';
import { UpdateApplyError, UpdateRollbackError, UpdateDownloadError } from '@cenf/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<UpdateConfig>): UpdateConfig {
  return {
    updateUrl: 'https://api.github.com/repos/myorg/myapp',
    publicKey: 'deadbeef',
    currentVersion: '1.0.0',
    rollbackEnabled: true,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) { return headers?.[name] ?? null; },
      forEach() {},
    },
    async json() { return data; },
    async arrayBuffer() { return Buffer.from(JSON.stringify(data)).buffer; },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// GitHubReleaseAdapter
// ---------------------------------------------------------------------------

describe('GitHubReleaseAdapter', () => {
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  let adapter: GitHubReleaseAdapter;

  function createAdapter() {
    adapter = new GitHubReleaseAdapter({
      config: makeConfig(),
      fetchFn: fetchMock,
    });
  }

  // -----------------------------------------------------------------------
  // getCurrentVersion
  // -----------------------------------------------------------------------

  describe('getCurrentVersion()', () => {
    it('returns config version by default', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      const v = await adapter.getCurrentVersion('myapp');
      expect(v).toBe('1.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // checkForUpdates
  // -----------------------------------------------------------------------

  describe('checkForUpdates()', () => {
    it('returns null when no release found', async () => {
      fetchMock = async () => jsonResponse({ message: 'Not Found' }, 404);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns null when current version is latest', async () => {
      fetchMock = async () => jsonResponse({
        tag_name: 'v1.0.0',
        assets: [],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns AvailableRelease when new version exists', async () => {
      fetchMock = async () => jsonResponse({
        tag_name: 'v2.0.0',
        assets: [{
          name: 'myapp-linux-x64.tar.gz',
          browser_download_url: 'https://github.com/myorg/myapp/releases/download/v2.0.0/myapp-linux-x64.tar.gz',
          content_type: 'application/gzip',
          size: 1024000,
        }],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('2.0.0');
      expect(result!.artifacts).toHaveLength(1);
    });

    it('strips v prefix from tag_name', async () => {
      fetchMock = async () => jsonResponse({
        tag_name: 'v3.0.0',
        assets: [],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('3.0.0');
    });

    it('handles non-v-prefixed tag_name', async () => {
      fetchMock = async () => jsonResponse({
        tag_name: '2.0.0',
        assets: [],
      }, 200);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result!.version).toBe('2.0.0');
    });
  });

  // -----------------------------------------------------------------------
  // downloadUpdate
  // -----------------------------------------------------------------------

  describe('downloadUpdate()', () => {
    it('selects artifact matching platform from release', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      const release = {
        version: '2.0.0',
        channel: Channel.Stable,
        artifacts: [{
          url: 'https://github.com/myorg/myapp/releases/download/v2.0.0/myapp-linux-x64.tar.gz',
          platform: 'linux',
          arch: 'x64',
          kind: 'archive',
          hash: 'a'.repeat(64),
        }],
        metadata: {},
      };
      const artifact = await adapter.downloadUpdate('myapp', release);
      expect(artifact.url).toContain('github.com');
      expect(artifact.platform).toBe('linux');
    });
  });

  // -----------------------------------------------------------------------
  // applyUpdate / rollback
  // -----------------------------------------------------------------------

  describe('applyUpdate() and rollback()', () => {
    it('applyUpdate throws (GitHub adapter only discovers)', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      await expect(
        adapter.applyUpdate('myapp', null as any),
      ).rejects.toThrow(UpdateApplyError);
    });

    it('rollback throws (GitHub adapter only discovers)', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      await expect(adapter.rollback('myapp')).rejects.toThrow(UpdateRollbackError);
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
      expect(h.details).toHaveProperty('repoUrl');
    });
  });
});
