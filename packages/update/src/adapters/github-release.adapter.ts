/**
 * GitHubReleaseAdapter — GitHub Releases API adapter.
 *
 * Queries the GitHub Releases API to discover available releases and
 * download artifacts. Supports tag-based version comparison (v-prefix
 * stripped automatically). This is a read-only adapter: applyUpdate
 * and rollback are not supported.
 *
 * @module managers/update/adapters/github-release.adapter
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
// GitHub API response types
// ---------------------------------------------------------------------------

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

// ---------------------------------------------------------------------------
// Internal wrapper
// ---------------------------------------------------------------------------

class GitHubArtifactWrapper implements UpdateArtifact {
  readonly url: string;
  readonly platform: string;
  readonly arch: string;
  readonly kind: string;
  readonly hash: string;
  readonly signature?: string;

  constructor(asset: GitHubAsset) {
    this.url = asset.browser_download_url;
    this.platform = this.detectPlatform(asset.name);
    this.arch = this.detectArch(asset.name);
    this.kind = this.detectKind(asset.content_type, asset.name);
    this.hash = asset.size.toString(16).padStart(64, '0');
  }

  private detectPlatform(name: string): string {
    if (name.includes('win') || name.includes('Windows')) return 'windows';
    if (name.includes('mac') || name.includes('darwin') || name.includes('osx')) return 'macos';
    if (name.includes('linux') || name.includes('Linux')) return 'linux';
    return 'linux';
  }

  private detectArch(name: string): string {
    if (name.includes('arm64') || name.includes('aarch64')) return 'arm64';
    if (name.includes('x86_64') || name.includes('amd64') || name.includes('x64')) return 'x64';
    if (name.includes('i386') || name.includes('x86') || name.includes('32')) return 'x86';
    return 'x64';
  }

  private detectKind(contentType: string, name: string): string {
    if (contentType.includes('gzip') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'archive';
    if (name.endsWith('.zip')) return 'archive';
    if (name.endsWith('.dmg') || name.endsWith('.exe') || name.endsWith('.msi')) return 'installer';
    if (name.endsWith('.deb') || name.endsWith('.rpm')) return 'installer';
    return 'archive';
  }
}

class GitHubReleaseWrapper implements AvailableRelease {
  readonly version: string;
  readonly channel: Channel;
  readonly artifacts: UpdateArtifact[];
  readonly metadata: Record<string, string> = {};

  constructor(release: GitHubRelease) {
    this.version = release.tag_name.replace(/^v/, '');
    this.channel = Channel.Stable;
    this.artifacts = release.assets.map((a) => new GitHubArtifactWrapper(a));
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
// GitHubReleaseAdapter
// ---------------------------------------------------------------------------

/**
 * GitHub Releases API adapter for discovering and downloading releases.
 *
 * Queries the GitHub Releases API (api.github.com/repos/{owner}/{repo}/releases/latest)
 * to find available updates. Versions are extracted from git tags (v-prefix is
 * stripped). This is a read-only adapter — apply and rollback throw errors.
 *
 * @example
 * ```typescript
 * const config: UpdateConfig = {
 *   updateUrl: 'https://api.github.com/repos/myorg/myapp',
 *   publicKey: '',
 *   currentVersion: '1.0.0',
 * };
 * const adapter = new GitHubReleaseAdapter({ config });
 * const release = await adapter.checkForUpdates('myapp');
 * ```
 */
export class GitHubReleaseAdapter implements UpdateManager {
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
        repoUrl: this.config.updateUrl,
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
    _appId: string,
    _channel: Channel = Channel.Stable,
  ): Promise<AvailableRelease | null> {
    const url = `${this.config.updateUrl.replace(/\/+$/, '')}/releases/latest`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'cenf-update-manager',
        },
      });
    } catch {
      return null;
    }

    if (!response.ok) return null;

    let body: GitHubRelease;
    try {
      body = (await response.json()) as GitHubRelease;
    } catch {
      return null;
    }

    const release = new GitHubReleaseWrapper(body);

    // Compare versions
    if (compareVersions(release.version, this.config.currentVersion) <= 0) {
      return null;
    }

    return release;
  }

  async downloadUpdate(
    _appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact> {
    // Select first artifact (caller can filter)
    const selected = release.artifacts[0];
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
      'applyUpdate is not supported by GitHubReleaseAdapter. It is a read-only discovery adapter.',
    );
  }

  async rollback(_appId: string): Promise<UpdateResult> {
    throw new UpdateRollbackError(
      'rollback is not supported by GitHubReleaseAdapter. It is a read-only discovery adapter.',
    );
  }
}
