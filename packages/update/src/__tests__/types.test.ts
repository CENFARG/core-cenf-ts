/**
 * Type validation tests for @cenf/update types.
 *
 * Ensures all interfaces, type aliases, and enums compile
 * correctly and runtime constants exist.
 */

import { describe, it, expect } from 'vitest';
import { Channel, UPDATE_TYPES_VERSION } from '../types.js';
import type {
  AvailableRelease,
  UpdateArtifact,
  UpdateResult,
  UpdateConfig,
} from '../types.js';

// ---------------------------------------------------------------------------
// Channel enum
// ---------------------------------------------------------------------------

describe('Channel enum', () => {
  it('has Stable, Beta, and Canary variants', () => {
    expect(Channel.Stable).toBe('stable');
    expect(Channel.Beta).toBe('beta');
    expect(Channel.Canary).toBe('canary');
  });
});

// ---------------------------------------------------------------------------
// UpdateConfig interface
// ---------------------------------------------------------------------------

describe('UpdateConfig', () => {
  it('uses defaults for optional fields', () => {
    const config: UpdateConfig = {
      updateUrl: 'https://updates.example.com',
      publicKey: 'deadbeef',
      currentVersion: '1.0.0',
    };
    expect(config.updateUrl).toBe('https://updates.example.com');
    expect(config.publicKey).toBe('deadbeef');
    expect(config.currentVersion).toBe('1.0.0');
    // rollbackEnabled defaults to true when not set
    expect(config.rollbackEnabled).toBeUndefined();
  });

  it('accepts rollbackEnabled false explicitly', () => {
    const config: UpdateConfig = {
      updateUrl: 'https://updates.example.com',
      publicKey: 'deadbeef',
      currentVersion: '1.0.0',
      rollbackEnabled: false,
    };
    expect(config.rollbackEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateArtifact interface
// ---------------------------------------------------------------------------

describe('UpdateArtifact', () => {
  it('has all required fields', () => {
    const artifact: UpdateArtifact = {
      url: 'https://example.com/app-v2.dmg',
      platform: 'macos',
      arch: 'x64',
      kind: 'installer',
      hash: 'a'.repeat(64),
    };
    expect(artifact.url).toBe('https://example.com/app-v2.dmg');
    expect(artifact.platform).toBe('macos');
    expect(artifact.arch).toBe('x64');
    expect(artifact.kind).toBe('installer');
    expect(artifact.hash.length).toBe(64);
  });

  it('has optional signature field', () => {
    const artifact: UpdateArtifact = {
      url: 'https://example.com/app-v2.dmg',
      platform: 'macos',
      arch: 'x64',
      kind: 'installer',
      hash: 'a'.repeat(64),
      signature: 'abc123',
    };
    expect(artifact.signature).toBe('abc123');
  });

  it('signature is undefined when not set', () => {
    const artifact: UpdateArtifact = {
      url: 'https://example.com/app-v2.dmg',
      platform: 'macos',
      arch: 'x64',
      kind: 'installer',
      hash: 'a'.repeat(64),
    };
    expect(artifact.signature).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AvailableRelease interface
// ---------------------------------------------------------------------------

describe('AvailableRelease', () => {
  const artifact: UpdateArtifact = {
    url: 'https://example.com/app-v2.dmg',
    platform: 'macos',
    arch: 'x64',
    kind: 'installer',
    hash: 'b'.repeat(64),
  };

  it('has version, channel, artifacts, and metadata', () => {
    const release: AvailableRelease = {
      version: '2.0.0',
      channel: Channel.Stable,
      artifacts: [artifact],
      metadata: { releaseNotesUrl: 'https://example.com/releases' },
    };
    expect(release.version).toBe('2.0.0');
    expect(release.channel).toBe('stable');
    expect(release.artifacts).toHaveLength(1);
    expect(release.artifacts[0].hash).toBe('b'.repeat(64));
    expect(release.metadata.releaseNotesUrl).toBe(
      'https://example.com/releases',
    );
  });

  it('metadata accepts arbitrary keys', () => {
    const release: AvailableRelease = {
      version: '2.0.0',
      channel: Channel.Beta,
      artifacts: [artifact],
      metadata: { minVersion: '1.5.0', custom: 'value' },
    };
    expect(release.metadata.minVersion).toBe('1.5.0');
    expect(release.metadata.custom).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// UpdateResult interface
// ---------------------------------------------------------------------------

describe('UpdateResult', () => {
  it('success result has newVersion', () => {
    const result: UpdateResult = {
      success: true,
      newVersion: '2.0.0',
    };
    expect(result.success).toBe(true);
    expect(result.newVersion).toBe('2.0.0');
    expect(result.error).toBeUndefined();
  });

  it('failure result has error message', () => {
    const result: UpdateResult = {
      success: false,
      error: 'Download failed: network timeout',
    };
    expect(result.success).toBe(false);
    expect(result.error).toContain('network timeout');
    expect(result.newVersion).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Runtime version constant
// ---------------------------------------------------------------------------

describe('UPDATE_TYPES_VERSION', () => {
  it('exports a runtime version constant', () => {
    expect(UPDATE_TYPES_VERSION).toBe('0.1.0');
  });
});
