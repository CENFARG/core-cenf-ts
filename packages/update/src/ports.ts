/**
 * UpdateManager port interface — desktop auto-update with signature verification and rollback.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * All infrastructure managers that need to discover and apply desktop
 * application updates consume this interface. Concrete adapters provide
 * HTTP-based update checks (HttpUpdateAdapter) or dict-backed simulation
 * (InMemoryUpdateAdapter for testing).
 *
 * Rules:
 *   - checkForUpdates() queries remote endpoint and compares versions.
 *   - downloadUpdate() verifies SHA-256 hash AND Ed25519 signature.
 *   - applyUpdate() installs with automatic rollback on failure.
 *   - rollback() restores the previous known-good version.
 *
 * Security: NEVER download or install an artifact without full signature
 *   and hash verification. Always delete partial downloads on failure.
 *
 * @module managers/update/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { AvailableRelease, Channel, UpdateArtifact, UpdateResult } from './types.js';

/**
 * Desktop auto-update contract with signature verification and rollback.
 *
 * Extends `AsyncLifecycle` for uniform orchestration via BootstrapOrchestrator.
 *
 * @ai-directive: Always verify signatures and hashes before installing.
 *   Never install unverified artifacts. Use rollback() to recover from
 *   failed updates.
 */
export interface UpdateManager extends AsyncLifecycle {
  /**
   * Return the currently installed version for an app.
   *
   * @param appId - The application identifier (e.g., "cenf-desktop").
   * @returns The current SemVer version string (e.g., "1.0.0").
   */
  getCurrentVersion(appId: string): Promise<string>;

  /**
   * Query the remote update service for the latest compatible release.
   *
   * Compares the current version against the latest release in the
   * specified channel. Returns null if no update is needed.
   *
   * @param appId - The application identifier.
   * @param channel - The update channel to query. Defaults to stable.
   * @returns The latest available release, or null if up-to-date.
   */
  checkForUpdates(
    appId: string,
    channel?: Channel,
  ): Promise<AvailableRelease | null>;

  /**
   * Download and verify the appropriate artifact for the current platform.
   *
   * Selects the correct artifact for the current platform and architecture,
   * downloads it, and verifies both the SHA-256 hash and Ed25519 digital
   * signature before returning.
   *
   * @param appId - The application identifier.
   * @param release - The AvailableRelease to download from.
   * @returns The verified artifact ready for installation.
   */
  downloadUpdate(
    appId: string,
    release: AvailableRelease,
  ): Promise<UpdateArtifact>;

  /**
   * Apply the update using platform-specific mechanisms.
   *
   * Saves the current version as rollback state before installing.
   * If the installation fails and rollback is enabled, automatically
   * restores the previous version.
   *
   * @param appId - The application identifier.
   * @param artifact - The verified UpdateArtifact to install.
   * @returns The result of the update application.
   */
  applyUpdate(
    appId: string,
    artifact: UpdateArtifact,
  ): Promise<UpdateResult>;

  /**
   * Rollback to the previous known-good version.
   *
   * Restores the previously installed version from rollback state.
   *
   * @param appId - The application identifier.
   * @returns The result of the rollback operation.
   */
  rollback(appId: string): Promise<UpdateResult>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const UPDATE_PORT_VERSION = '0.1.0';
