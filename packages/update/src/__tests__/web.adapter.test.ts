/**
 * Tests for WebUpdateAdapter — x-client-version header polling adapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebUpdateAdapter } from '../adapters/web.adapter.js';
import { Channel } from '../types.js';
import type { UpdateConfig, UpdateArtifact } from '../types.js';
import { UpdateApplyError, UpdateRollbackError } from '@cenf/core';

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

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  const h = new Map(Object.entries(headers ?? {}));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) { return h.get(name) ?? null; },
      forEach(fn: (v: string, k: string) => void) { h.forEach(fn); },
    },
    async json() { return data; },
    clone() { return jsonResponse(data, status, headers); },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// WebUpdateAdapter
// ---------------------------------------------------------------------------

describe('WebUpdateAdapter', () => {
  let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  let adapter: WebUpdateAdapter;

  function createAdapter() {
    adapter = new WebUpdateAdapter({
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
    it('returns null on 304 Not Modified', async () => {
      fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
        return jsonResponse({}, 304);
      };
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns null on 404', async () => {
      fetchMock = async () => jsonResponse({ error: 'not found' }, 404);
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });

    it('returns an AvailableRelease when update is found', async () => {
      fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
        return jsonResponse({
          version: '2.0.0',
          channel: 'stable',
          artifacts: [{
            url: 'https://example.com/app-v2.js',
            platform: 'web',
            arch: 'x64',
            kind: 'archive',
            hash: 'a'.repeat(64),
          }],
        }, 200);
      };
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).not.toBeNull();
      expect(result!.version).toBe('2.0.0');
      expect(result!.artifacts).toHaveLength(1);
    });

    it('sends x-client-version header', async () => {
      let sentHeaders: Record<string, string> = {};
      fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
        const opts = init as RequestInit;
        const hdrs = opts?.headers as Record<string, string> ?? {};
        sentHeaders = hdrs;
        return jsonResponse({ version: '2.0.0', channel: 'stable', artifacts: [] }, 200);
      };
      createAdapter();
      await adapter.checkForUpdates('myapp');
      expect(sentHeaders['x-client-version']).toBe('1.0.0');
    });

    it('returns null when current version equals latest', async () => {
      fetchMock = async () => {
        return jsonResponse({ version: '1.0.0', channel: 'stable', artifacts: [] }, 200);
      };
      createAdapter();
      const result = await adapter.checkForUpdates('myapp');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // downloadUpdate
  // -----------------------------------------------------------------------

  describe('downloadUpdate()', () => {
    it('selects web-platform artifact', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      const release = {
        version: '2.0.0',
        channel: Channel.Stable,
        artifacts: [{
          url: 'https://example.com/app.js',
          platform: 'web',
          arch: 'x64',
          kind: 'archive',
          hash: 'b'.repeat(64),
        }],
        metadata: {},
      };
      const artifact = await adapter.downloadUpdate('myapp', release);
      expect(artifact.platform).toBe('web');
    });
  });

  // -----------------------------------------------------------------------
  // applyUpdate / rollback
  // -----------------------------------------------------------------------

  describe('applyUpdate() and rollback()', () => {
    it('applyUpdate throws (web apps update via page refresh)', async () => {
      fetchMock = async () => jsonResponse({}, 200);
      createAdapter();
      const artifact: UpdateArtifact = {
        url: 'https://example.com/app.js',
        platform: 'web',
        arch: 'x64',
        kind: 'archive',
        hash: 'c'.repeat(64),
      };
      await expect(adapter.applyUpdate('myapp', artifact)).rejects.toThrow(UpdateApplyError);
    });

    it('rollback throws (web apps rollback via deploy)', async () => {
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
      expect(h.details).toHaveProperty('updateUrl');
    });
  });
});
