/**
 * InMemoryUpdateAdapter — dict-backed UpdateManager test double.
 *
 * Provides a lightweight, zero-I/O adapter for unit testing components that
 * depend on UpdateManager. Pre-configured releases are stored per channel
 * in a dict and evaluated entirely in memory.
 *
 * Security: This adapter performs NO cryptographic validation. NEVER use
 *     it in production.
 *
 * @module managers/update/adapters/in-memory.adapter
 */

import type { UpdateManager } from '../ports.js';
import { Channel } from '../types.js';
import type {
  AvailableRelease,
  UpdateArtifact,
  UpdateConfig,
  UpdateResult,
} from '../types.js';
import { UpdateDownloadError, UpdateRollbackError } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple SemVer comparison. Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
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
// Helpers: SemVer bump
// ---------------------------------------------------------------------------

/**
 * Bump the patch version of a SemVer string.
 */
function bumpPatch(v: string): string {
  const parts = v.split('.').map(Number);
  return `${parts[0] || 0}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface RollbackState {
  previousVersion: string;
  previousHash: string;
}

// ---------------------------------------------------------------------------
// InMemoryUpdateAdapter
// ---------------------------------------------------------------------------

/**
 * Dict-backed UpdateManager test double with rollback support.
 *
 * Pre-load releases via addRelease() before running tests. Each channel
 * stores a single latest release. Version comparison uses simple SemVer
 * ordering.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://updates.example.com',
 *   publicKey: 'test-key',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new InMemoryUpdateAdapter({ config });
 * adapter.addRelease(Channel.Stable, release);
 * const result = await adapter.checkForUpdates('myapp');
 * ```
 */
export class InMemoryUpdateAdapter implements UpdateManager {
  private config: UpdateConfig;
  private platform: string;
  private releases = new Map<string, AvailableRelease>();
  private rollbackStates = new Map<string, RollbackState>();
  private currentVersions = new Map<string, string>();
  private currentHashes = new Map<string, string>();
  private failNextApply = false;

  constructor(opts: {
    config: UpdateConfig;
    overridePlatform?: string;
  }) {
    this.config = opts.config;
    this.platform = opts.overridePlatform ?? detectPlatform();
  }

  // -----------------------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------------------

  /**
   * Pre-configure a release for a channel (test helper).
   *
   * @param channel - The update channel.
   * @param release - The AvailableRelease to store.
   */
  addRelease(channel: Channel | string, release: AvailableRelease): void {
    this.releases.set(channel, release);
  }

  /**
   * Set whether the next applyUpdate call should fail (test helper).
   *
   * @param fail - If true, the next applyUpdate will simulate failure.
   */
  setFailNextApply(fail: boolean): void {
    this.failNextApply = fail;
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.releases = new Map();
    this.rollbackStates = new Map();
    this.currentVersions = new Map();
    this.currentHashes = new Map();
    this.failNextApply = false;
  }

  async stop(): Promise<void> {
    this.releases.clear();
    this.rollbackStates.clear();
    this.currentVersions.clear();
    this.currentHashes.clear();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        updateUrl: this.config.updateUrl,
        currentVersion: this.config.currentVersion,
        platform: this.platform,
        activeReleases: this.releases.size,
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
    channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    const release = this.releases.get(channel);
    if (!release) return null;

    const current = await this.getCurrentVersion(appId);
    if (compareVersions(release.version, current) <= 0) {
      return null;
    }

    return release;
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    for (const artifact of release.artifacts) {
      if (artifact.platform === this.platform) {
        return artifact;
      }
    }

    throw new UpdateDownloadError(
      `No artifact found for platform '${this.platform}' in release ${release.version}`,
    );
  }

  async applyUpdate(
    appId: string,
    artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    const previous = await this.getCurrentVersion(appId);
    const previousHash = this.currentHashes.get(appId) ?? artifact.hash;

    // Save rollback state BEFORE attempting apply
    this.rollbackStates.set(appId, {
      previousVersion: previous,
      previousHash,
    });

    // Check test hook for simulated failure
    if (this.failNextApply) {
      this.failNextApply = false;

      if (this.config.rollbackEnabled) {
        this.currentVersions.set(appId, previous);
        return {
          success: false,
          error: 'Apply failed: simulated error (auto-rollback triggered)',
        };
      }

      const newVersion = this.resolveNewVersion(appId, artifact);
      this.currentVersions.set(appId, newVersion);
      this.currentHashes.set(appId, artifact.hash);
      return { success: false, error: 'Apply failed: simulated error' };
    }

    // Normal success path
    const newVersion = this.resolveNewVersion(appId, artifact);
    this.currentVersions.set(appId, newVersion);
    this.currentHashes.set(appId, artifact.hash);
    return { success: true, newVersion };
  }

  async rollback(appId: string): Promise<UpdateResult> {
    const state = this.rollbackStates.get(appId);
    if (!state) {
      throw new UpdateRollbackError(
        `No rollback state available for app '${appId}'`,
      );
    }

    this.currentVersions.set(appId, state.previousVersion);
    return { success: true, newVersion: state.previousVersion };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Resolve the new version after applying an artifact.
   * Walks releases to find one containing this artifact.
   */
  private resolveNewVersion(appId: string, artifact: UpdateArtifact): string {
    for (const release of this.releases.values()) {
      for (const a of release.artifacts) {
        if (a.url === artifact.url) {
          return release.version;
        }
      }
    }

    // Fallback: bump patch
    const current = this.currentVersions.get(appId) ?? this.config.currentVersion;
    return bumpPatch(current);
  }
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/**
 * Detect the current platform for artifact selection.
 *
 * @returns One of "windows", "macos", "linux".
 */
function detectPlatform(): string {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform.startsWith('win')) return 'windows';
    if (process.platform === 'darwin') return 'macos';
    return 'linux';
  }
  return 'linux';
}
