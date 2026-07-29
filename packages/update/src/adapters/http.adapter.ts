/**
 * HttpUpdateAdapter — HTTP-based UpdateManager adapter.
 *
 * Performs desktop app auto-updates via HTTP. Verifies SHA-256 hashes
 * and Ed25519 digital signatures before accepting any artifact. Uses
 * simple SemVer comparison.
 *
 * Security: downloadUpdate() verifies SHA-256 hash AND Ed25519 signature
 *     before returning. On hash/signature mismatch, throws UpdateDownloadError.
 *     Partial downloads are discarded on failure.
 *
 * @module managers/update/adapters/http.adapter
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
  UpdateCheckError,
  UpdateDownloadError,
  UpdateApplyError,
  UpdateRollbackError,
} from '@cenf/core';
import type { HealthStatus } from '@cenf/core';
import { computeShasum, verifySignature } from '../helpers/crypto.js';

// ---------------------------------------------------------------------------
// Internal wrapper classes (parse JSON → typed interfaces)
// ---------------------------------------------------------------------------

interface ArtifactMetaJson {
  url: string;
  platform: string;
  arch: string;
  kind: string;
  hash: string;
  signature?: string;
}

interface ReleaseMetaJson {
  version: string;
  channel: string;
  artifacts: ArtifactMetaJson[];
  release_notes_url?: string;
  min_version?: string;
}

/**
 * Wraps parsed JSON artifact meta as an UpdateArtifact.
 */
class ArtifactWrapper implements UpdateArtifact {
  readonly url: string;
  readonly platform: string;
  readonly arch: string;
  readonly kind: string;
  readonly hash: string;
  readonly signature?: string;

  constructor(meta: ArtifactMetaJson) {
    this.url = meta.url;
    this.platform = meta.platform;
    this.arch = meta.arch;
    this.kind = meta.kind;
    this.hash = meta.hash;
    this.signature = meta.signature;
  }
}

/**
 * Wraps parsed JSON release meta as an AvailableRelease.
 */
class ReleaseWrapper implements AvailableRelease {
  readonly version: string;
  readonly channel: Channel;
  readonly artifacts: UpdateArtifact[];
  readonly metadata: Record<string, string>;

  constructor(meta: ReleaseMetaJson) {
    this.version = meta.version;
    this.channel = meta.channel as Channel;
    this.artifacts = meta.artifacts.map((a) => new ArtifactWrapper(a));
    this.metadata = {};
    if (meta.release_notes_url) {
      this.metadata.releaseNotesUrl = meta.release_notes_url;
    }
    if (meta.min_version) {
      this.metadata.minVersion = meta.min_version;
    }
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
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(): string {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform.startsWith('win')) return 'windows';
    if (process.platform === 'darwin') return 'macos';
    return 'linux';
  }
  return 'linux';
}

// ---------------------------------------------------------------------------
// HttpUpdateAdapter
// ---------------------------------------------------------------------------

/**
 * HTTP-based UpdateManager adapter with SHA-256 + Ed25519 verification.
 *
 * Queries a remote update endpoint, compares versions using SemVer,
 * downloads and verifies artifacts, and delegates apply/rollback to
 * platform-specific sub-adapters.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://updates.cenf.app',
 *   publicKey: 'ed25519-public-key-hex',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new HttpUpdateAdapter({ config });
 * const release = await adapter.checkForUpdates('cenf-desktop');
 * ```
 */
export class HttpUpdateAdapter implements UpdateManager {
  private config: UpdateConfig;
  private platform: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(opts: {
    config: UpdateConfig;
    overridePlatform?: string;
    fetchFn?: typeof globalThis.fetch;
  }) {
    this.config = opts.config;
    this.platform = opts.overridePlatform ?? detectPlatform();
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: HTTP adapter has no persistent state to initialize.
  }

  async stop(): Promise<void> {
    // No-op: HTTP adapter has no persistent state to clean up.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        updateUrl: this.config.updateUrl,
        platform: this.platform,
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
    channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    const url = `${this.config.updateUrl.replace(/\/+$/, '')}/${appId}/latest?channel=${channel}`;

    let response: Response;
    try {
      response = await this.fetchFn(url);
    } catch (err) {
      throw new UpdateCheckError(
        `Update check failed for app '${appId}': ${(err as Error).message}`,
      );
    }

    if (!response.ok) return null;

    let body: ReleaseMetaJson;
    try {
      body = (await response.json()) as ReleaseMetaJson;
    } catch {
      throw new UpdateCheckError(
        `Invalid response from update server for app '${appId}'`,
      );
    }

    const current = await this.getCurrentVersion(appId);
    if (compareVersions(body.version, current) <= 0) return null;

    return new ReleaseWrapper(body);
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    // Select artifact for current platform
    const selected = release.artifacts.find(
      (a) => a.platform === this.platform,
    );
    if (!selected) {
      throw new UpdateDownloadError(
        `No artifact found for platform '${this.platform}' in release ${release.version}`,
      );
    }

    // Download the artifact binary
    let response: Response;
    try {
      response = await this.fetchFn(selected.url);
    } catch (err) {
      throw new UpdateDownloadError(
        `Failed to download artifact from ${selected.url}: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new UpdateDownloadError(
        `Failed to download artifact from ${selected.url}: HTTP ${response.status}`,
      );
    }

    let rawData: Buffer;
    try {
      const ab = await response.arrayBuffer();
      rawData = Buffer.from(ab);
    } catch {
      throw new UpdateDownloadError(
        `Failed to read artifact data from ${selected.url}`,
      );
    }

    // Verify SHA-256 hash
    const computedHash = computeShasum(rawData);
    if (computedHash !== selected.hash) {
      throw new UpdateDownloadError(
        'Hash mismatch: downloaded artifact does not match expected SHA-256 digest',
      );
    }

    // Verify Ed25519 signature if present
    if (selected.signature) {
      const valid = verifySignature(
        rawData,
        selected.signature,
        this.config.publicKey,
      );
      if (!valid) {
        throw new UpdateDownloadError(
          'Signature verification failed: the artifact signature does not match the configured public key',
        );
      }
    }

    return selected;
  }

  async applyUpdate(
    _appId: string,
    _artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    throw new UpdateApplyError(
      'applyUpdate is not supported by HttpUpdateAdapter. Use a platform-specific sub-adapter.',
    );
  }

  async rollback(_appId: string): Promise<UpdateResult> {
    throw new UpdateRollbackError(
      'rollback is not supported by HttpUpdateAdapter. Use a platform-specific sub-adapter.',
    );
  }
}
