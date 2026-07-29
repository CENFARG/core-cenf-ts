/**
 * @cenf/update types — AvailableRelease, UpdateArtifact, UpdateResult, UpdateConfig, Channel.
 *
 * @module managers/update/types
 */

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/**
 * Update distribution channels.
 *
 * - `Stable`: Production-ready releases for all users.
 * - `Beta`: Pre-release for early adopters and QA.
 * - `Canary`: Bleeding-edge builds for internal validation.
 */
export enum Channel {
  Stable = 'stable',
  Beta = 'beta',
  Canary = 'canary',
}

// ---------------------------------------------------------------------------
// UpdateConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for UpdateManager adapters.
 *
 * Controls the update endpoint URL, Ed25519 public key for signature
 * verification, current installed version, and rollback behaviour.
 */
export interface UpdateConfig {
  /** Base URL of the update service endpoint. */
  updateUrl: string;

  /** Ed25519 public key (hex-encoded) for signature verification. */
  publicKey: string;

  /** Currently installed SemVer version. */
  currentVersion: string;

  /** Whether automatic rollback on failure is enabled. Default: true. */
  rollbackEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// UpdateArtifact
// ---------------------------------------------------------------------------

/**
 * A downloadable update package for a specific platform.
 *
 * Describes a single update artifact with its download URL, target
 * platform, architecture, package kind, SHA-256 hash, and optional
 * digital signature.
 *
 * Security:
 *   `hash` MUST be a 64-character SHA-256 hex digest.
 *   `signature` is the Ed25519 signature or undefined if unsigned.
 */
export interface UpdateArtifact {
  /** The download URL for this artifact. */
  url: string;

  /** Target platform: "windows", "macos", "linux". */
  platform: string;

  /** Target CPU architecture: "x64", "arm64". */
  arch: string;

  /** Artifact kind: "installer", "archive", "delta". */
  kind: string;

  /** SHA-256 hex digest (64-character lowercase hex string). */
  hash: string;

  /** Ed25519 base64-encoded signature, or undefined if unsigned. */
  signature?: string;
}

// ---------------------------------------------------------------------------
// AvailableRelease
// ---------------------------------------------------------------------------

/**
 * Metadata describing an available update release.
 *
 * Represents a single release with its SemVer version, update channel,
 * list of platform-specific artifacts, and additional metadata.
 */
export interface AvailableRelease {
  /** SemVer version string (e.g., "2.0.0"). */
  version: string;

  /** Update channel (stable, beta, canary). */
  channel: Channel;

  /** List of platform-specific UpdateArtifacts. */
  artifacts: UpdateArtifact[];

  /** Additional release metadata as key-value pairs. */
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// UpdateResult
// ---------------------------------------------------------------------------

/**
 * Result of an update application attempt.
 *
 * Represents the outcome of applying or rolling back an update,
 * including success status, new version identifier, and error
 * information for failures.
 *
 * Security: `error` MUST NOT contain sensitive information (paths, keys).
 */
export interface UpdateResult {
  /** Whether the update was applied successfully. */
  success: boolean;

  /** The version after the update, or undefined on failure. */
  newVersion?: string;

  /** Error description if the update failed, or undefined on success. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const UPDATE_TYPES_VERSION = '0.1.0';
