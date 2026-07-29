/**
 * AndroidUpdateAdapter — Play Core + PackageInstaller adapter.
 *
 * Manages Android app updates via a custom update endpoint that mimics
 * Play Core's in-app update API. Downloads APK/AAB artifacts, verifies
 * hashes, and delegates installation to the platform's PackageInstaller.
 *
 * Rollback is NOT supported on Android — installed APKs cannot be
 * reverted programmatically. rollback() always throws UpdateRollbackError.
 *
 * Security: All downloaded artifacts are SHA-256 verified before
 *     installation. Partial downloads are discarded on failure.
 *
 * @module managers/update/adapters/android.adapter
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
import { computeShasum } from '../helpers/crypto.js';

// ---------------------------------------------------------------------------
// JSON response types
// ---------------------------------------------------------------------------

interface ArtifactJson {
  url: string;
  platform: string;
  arch: string;
  kind: string;
  hash: string;
  signature?: string;
}

interface UpdateCheckJson {
  versionCode: number;
  versionName: string;
  artifacts: ArtifactJson[];
}

// ---------------------------------------------------------------------------
// Internal wrapper
// ---------------------------------------------------------------------------

class AndroidArtifactWrapper implements UpdateArtifact {
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

class AndroidReleaseWrapper implements AvailableRelease {
  readonly version: string;
  readonly channel: Channel;
  readonly artifacts: UpdateArtifact[];
  readonly metadata: Record<string, string>;

  constructor(json: UpdateCheckJson) {
    this.version = json.versionName;
    this.channel = Channel.Stable;
    this.artifacts = json.artifacts.map((a) => new AndroidArtifactWrapper(a));
    this.metadata = {
      versionCode: String(json.versionCode),
    };
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
// AndroidUpdateAdapter
// ---------------------------------------------------------------------------

/**
 * Android update adapter with Play Core-style in-app update support.
 *
 * Queries a custom update endpoint, downloads and verifies APK/AAB
 * artifacts, and simulates PackageInstaller-based apply. Rollback is
 * not supported — it always throws UpdateRollbackError.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://play.googleapis.com',
 *   publicKey: 'test-key',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new AndroidUpdateAdapter({ config });
 * const release = await adapter.checkForUpdates('com.example.app');
 * ```
 */
export class AndroidUpdateAdapter implements UpdateManager {
  private config: UpdateConfig;
  private fetchFn: typeof globalThis.fetch;
  private currentVersions = new Map<string, string>();

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
    // Clear version state
    this.currentVersions.clear();
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

  async getCurrentVersion(appId: string): Promise<string> {
    return this.currentVersions.get(appId) ?? this.config.currentVersion;
  }

  async checkForUpdates(
    appId: string,
    _channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    const url = `${this.config.updateUrl.replace(/\/+$/, '')}/apps/${appId}`;

    let response: Response;
    try {
      response = await this.fetchFn(url);
    } catch {
      return null;
    }

    if (!response.ok) return null;

    let body: UpdateCheckJson;
    try {
      body = (await response.json()) as UpdateCheckJson;
    } catch {
      return null;
    }

    // Compare versionName against current
    const current = await this.getCurrentVersion(appId);
    if (compareVersions(body.versionName, current) <= 0) return null;

    return new AndroidReleaseWrapper(body);
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    const selected = release.artifacts.find(
      (a) => a.platform === 'android',
    );
    if (!selected) {
      throw new UpdateDownloadError(
        `No Android artifact found in release ${release.version}`,
      );
    }

    // Download and verify
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
    const computed = computeShasum(rawData);
    if (computed !== selected.hash) {
      throw new UpdateDownloadError(
        'Hash mismatch: downloaded APK does not match expected SHA-256 digest',
      );
    }

    return selected;
  }

  async applyUpdate(
    appId: string,
    artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    // Simulate PackageInstaller apply
    // On a real device, this would use the Play Core in-app update API
    // or PackageInstaller.Session for APK installation.

    // Extract version from artifact URL or bump from current
    const match = artifact.url.match(/(\d+\.\d+\.\d+)/);
    const newVersion = match
      ? match[1]
      : this.bumpPatch(await this.getCurrentVersion(appId));

    this.currentVersions.set(appId, newVersion);
    return { success: true, newVersion };
  }

  async rollback(_appId: string): Promise<UpdateResult> {
    throw new UpdateRollbackError(
      'rollback is not supported on Android. Installed APKs cannot be reverted programmatically.',
    );
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private bumpPatch(v: string): string {
    const parts = v.split('.').map(Number);
    return `${parts[0] || 0}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
  }
}
