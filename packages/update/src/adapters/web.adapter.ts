/**
 * WebUpdateAdapter — x-client-version header polling adapter.
 *
 * Lightweight update checker for web applications. Polls an endpoint with
 * an `x-client-version` header to check for updates. Server responds with
 * the latest version info or 304 Not Modified. No binary download is
 * performed — web apps update via page refresh / CDN cache bust.
 *
 * @module managers/update/adapters/web.adapter
 */

import type { UpdateManager } from '../ports.js';
import { Channel } from '../types.js';
import type {
  AvailableRelease,
  UpdateArtifact,
  UpdateConfig,
  UpdateResult,
} from '../types.js';
import {
  UpdateApplyError,
  UpdateDownloadError,
  UpdateRollbackError,
} from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Internal wrapper
// ---------------------------------------------------------------------------

interface ArtifactJson {
  url: string;
  platform: string;
  arch: string;
  kind: string;
  hash: string;
  signature?: string;
}

interface ReleaseJson {
  version: string;
  channel: string;
  artifacts: ArtifactJson[];
}

class WebArtifactWrapper implements UpdateArtifact {
  readonly url: string;
  readonly platform: string;
  readonly arch: string;
  readonly kind: string;
  readonly hash: string;
  readonly signature?: string;

  constructor(json: ArtifactJson) {
    this.url = json.url;
    this.platform = json.platform;
    this.arch = json.arch;
    this.kind = json.kind;
    this.hash = json.hash;
    this.signature = json.signature;
  }
}

class WebReleaseWrapper implements AvailableRelease {
  readonly version: string;
  readonly channel: Channel;
  readonly artifacts: UpdateArtifact[];
  readonly metadata: Record<string, string> = {};

  constructor(json: ReleaseJson) {
    this.version = json.version;
    this.channel = json.channel as Channel;
    this.artifacts = json.artifacts.map((a) => new WebArtifactWrapper(a));
  }
}

// ---------------------------------------------------------------------------
// SemVer comparison
// ---------------------------------------------------------------------------

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// WebUpdateAdapter
// ---------------------------------------------------------------------------

/**
 * Lightweight update checker for web applications using x-client-version polling.
 *
 * Sends an `x-client-version` header to the configured endpoint. The server
 * responds with the latest release info (200) or No-Content (304) if the
 * client version is current.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://api.example.com/updates',
 *   publicKey: 'test-key',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new WebUpdateAdapter({ config });
 * const release = await adapter.checkForUpdates('myapp');
 * ```
 */
export class WebUpdateAdapter implements UpdateManager {
  private config: UpdateConfig;
  private fetchFn: typeof globalThis.fetch;

  constructor(opts: {
    config: UpdateConfig;
    fetchFn?: typeof globalThis.fetch;
  }) {
    this.config = opts.config;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op
  }

  async stop(): Promise<void> {
    // No-op
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        updateUrl: this.config.updateUrl,
      },
    };
  }

  // -----------------------------------------------------------------------
  // UpdateManager
  // -----------------------------------------------------------------------

  async getCurrentVersion(_appId: string): Promise<string> {
    return this.config.currentVersion;
  }

  async checkForUpdates(
    appId: string,
    _channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    const url = `${this.config.updateUrl.replace(/\/+$/, '')}/${appId}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: {
          'x-client-version': this.config.currentVersion,
        },
      });
    } catch {
      return null;
    }

    // 304 Not Modified = no update needed
    if (response.status === 304) return null;
    if (!response.ok) return null;

    let body: ReleaseJson;
    try {
      body = (await response.json()) as ReleaseJson;
    } catch {
      return null;
    }

    // Compare versions
    if (compareVersions(body.version, this.config.currentVersion) <= 0) {
      return null;
    }

    return new WebReleaseWrapper(body);
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    // Select a "web" platform artifact, or fall back to any artifact
    const selected =
      release.artifacts.find((a) => a.platform === 'web') ??
      release.artifacts[0];

    if (!selected) {
      throw new UpdateDownloadError(
        `No artifacts found in release ${release.version}`,
      );
    }

    return selected;
  }

  async applyUpdate(
    _appId: string,
    _artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    throw new UpdateApplyError(
      'applyUpdate is not supported by WebUpdateAdapter. Web applications update via page refresh or CDN cache bust.',
    );
  }

  async rollback(_appId: string): Promise<UpdateResult> {
    throw new UpdateRollbackError(
      'rollback is not supported by WebUpdateAdapter. Web applications rollback via deploy.',
    );
  }
}
