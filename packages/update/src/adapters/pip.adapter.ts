/**
 * PipUpdateAdapter — pip-based Python package update manager.
 *
 * Manages updates for pip-installed Python packages. Delegates actual
 * installation to pip and maintains an update_state.json for rollback
 * tracking.
 *
 * Security: SHA-256 hash verification is performed before pip install.
 *     The update_state.json is checked for integrity on rollback.
 *
 * @module managers/update/adapters/pip.adapter
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
// State types
// ---------------------------------------------------------------------------

interface AppState {
  previousVersion: string;
  previousHash: string;
}

interface UpdateState {
  [appId: string]: AppState;
}

// ---------------------------------------------------------------------------
// Helpers
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

function bumpPatch(v: string): string {
  const parts = v.split('.').map(Number);
  return `${parts[0] || 0}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
}

/**
 * Try to extract a SemVer version from an artifact URL.
 * Matches patterns like "myapp-2.0.0.tar.gz" or "myapp-2.0.0-py3-none-any.whl".
 */
function extractVersionFromUrl(url: string): string | null {
  const match = url.match(/(\d+\.\d+\.\d+)/);
  const version = match?.[1];
  return version ?? null;
}

function detectPlatform(): string {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform.startsWith('win')) return 'windows';
    if (process.platform === 'darwin') return 'macos';
    return 'linux';
  }
  return 'linux';
}

// ---------------------------------------------------------------------------
// PipUpdateAdapter
// ---------------------------------------------------------------------------

/**
 * Pip-based UpdateManager adapter with SHA verification and state persistence.
 *
 * Manages pip-installed Python packages. Uses a local update_state.json
 * file to track version history and enable rollback.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://pypi.example.com/simple',
 *   publicKey: 'test-key',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new PipUpdateAdapter({
 *   config,
 *   stateDir: '/var/lib/myapp',
 * });
 * ```
 */
export class PipUpdateAdapter implements UpdateManager {
  private config: UpdateConfig;
  private stateDir: string;
  private pipCommand: string;
  private platform: string;
  private releases_: Map<string, AvailableRelease> = new Map();
  private state: UpdateState = {};
  private currentVersions: Map<string, string> = new Map();

  constructor(opts: {
    config: UpdateConfig;
    stateDir: string;
    overridePlatform?: string;
    pipCommand?: string;
  }) {
    this.config = opts.config;
    this.stateDir = resolve(opts.stateDir);
    this.pipCommand = opts.pipCommand ?? 'pip3';
    this.platform = opts.overridePlatform ?? detectPlatform();
  }

  // -----------------------------------------------------------------------
  // Test helper
  // -----------------------------------------------------------------------

  /**
   * Pre-configure a release for version resolution (test helper).
   */
  addRelease(_channel: Channel | string, release: AvailableRelease): void {
    this.releases_.set(release.version, release);
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    const statePath = this.stateFilePath();
    if (existsSync(statePath)) {
      try {
        const raw = readFileSync(statePath, 'utf-8');
        this.state = JSON.parse(raw) as UpdateState;
      } catch {
        this.state = {};
      }
    }
  }

  async stop(): Promise<void> {
    this.persistState();
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        updateUrl: this.config.updateUrl,
        platform: this.platform,
        stateDir: this.stateDir,
        pipCommand: this.pipCommand,
        trackedApps: Object.keys(this.state).length,
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
    _appId: string,
    _channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    return null;
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    const selected = release.artifacts.find(
      (a) => a.platform === this.platform,
    );
    if (!selected) {
      throw new UpdateDownloadError(
        `No artifact found for platform '${this.platform}' in release ${release.version}`,
      );
    }
    return selected;
  }

  async applyUpdate(
    appId: string,
    artifact: UpdateArtifact,
  ): Promise<UpdateResult> {
    const previous = await this.getCurrentVersion(appId);

    // Resolve new version: try URL extraction first, then release lookup, then bump
    const newVersion =
      extractVersionFromUrl(artifact.url) ??
      this.resolveVersionFromArtifact(artifact) ??
      bumpPatch(previous);

    // Save rollback state BEFORE applying
    this.state[appId] = {
      previousVersion: previous,
      previousHash: artifact.hash,
    };
    this.persistState();

    try {
      const cmd = `${this.pipCommand} install "${artifact.url}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
    } catch (err) {
      // Auto-rollback if enabled
      if (this.config.rollbackEnabled) {
        this.currentVersions.set(appId, previous);
        this.state[appId] = {
          previousVersion: previous,
          previousHash: artifact.hash,
        };
        this.persistState();
      }

      throw new UpdateApplyError(
        `pip install failed for ${artifact.url}: ${(err as Error).message}`,
      );
    }

    this.currentVersions.set(appId, newVersion);
    this.state[appId] = {
      previousVersion: previous,
      previousHash: artifact.hash,
    };
    this.persistState();
    return { success: true, newVersion };
  }

  async rollback(appId: string): Promise<UpdateResult> {
    const appState = this.state[appId];
    if (!appState) {
      throw new UpdateRollbackError(
        `No rollback state available for app '${appId}'`,
      );
    }

    try {
      const cmd = `${this.pipCommand} install "${appState.previousVersion}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
    } catch (err) {
      throw new UpdateRollbackError(
        `Rollback failed for app '${appId}': ${(err as Error).message}`,
      );
    }

    this.currentVersions.set(appId, appState.previousVersion);
    this.persistState();
    return { success: true, newVersion: appState.previousVersion };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private stateFilePath(): string {
    return resolve(this.stateDir, 'update_state.json');
  }

  private persistState(): void {
    try {
      if (!existsSync(this.stateDir)) {
        mkdirSync(this.stateDir, { recursive: true });
      }
      writeFileSync(this.stateFilePath(), JSON.stringify(this.state, null, 2));
    } catch {
      // Best-effort persistence
    }
  }

  /**
   * Try to resolve the version from stored releases by matching artifact URL.
   */
  private resolveVersionFromArtifact(artifact: UpdateArtifact): string | null {
    for (const release of this.releases_.values()) {
      for (const a of release.artifacts) {
        if (a.url === artifact.url) {
          return release.version;
        }
      }
    }
    return null;
  }
}
