/**
 * In-memory licence adapter — hardcoded licence for testing.
 *
 * Implements the LicenceManager port with zero external dependencies.
 * Provides a default hardcoded licence with common features for
 * testing validation and expiry logic.
 *
 * @module managers/licence/adapters/memory.adapter
 */

import type { LicenceManager } from '../ports.js';
import type { Licence, LicenceFeature } from '../types.js';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// InMemoryLicenceAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory licence adapter backed by a hardcoded or injected licence.
 *
 * Loads a default licence with common features (audit-log,
 * advanced-metrics, sso) for testing purposes. Supports injecting
 * a pre-built Licence object for custom scenarios.
 *
 * Use this adapter:
 * - In unit tests where a real licence server is not available
 * - For testing feature gating and expiry logic
 * - As a fallback when the production licence service is unavailable
 */
export class InMemoryLicenceAdapter implements LicenceManager {
  private licence: Licence | null = null;
  private readonly defaultLicence: Licence;

  /**
   * Create an in-memory licence adapter.
   *
   * If no licence is provided, a default hardcoded licence is used
   * with common features for testing.
   *
   * @param fixedLicence - Optional pre-built licence to use instead of the default.
   */
  constructor(fixedLicence?: Licence) {
    this.defaultLicence = fixedLicence ?? {
      key: 'DEFAULT',
      status: 'valid',
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-12-31'),
      features: [
        { name: 'audit-log', enabled: true },
        { name: 'advanced-metrics', enabled: true },
        { name: 'sso', enabled: false, limits: { maxUsers: 100 } },
      ],
      holder: 'CENF Test',
    };
  }

  // -----------------------------------------------------------------------
  // LicenceManager
  // -----------------------------------------------------------------------

  async loadLicence(key: string): Promise<Licence> {
    const licence: Licence = {
      ...this.defaultLicence,
      key,
      features: this.defaultLicence.features.map((f) => ({ ...f })),
    };
    this.licence = licence;
    return licence;
  }

  async validateLicence(): Promise<boolean> {
    if (!this.licence) return false;
    return (
      this.licence.status !== 'expired' &&
      this.licence.status !== 'invalid' &&
      !this.isExpiredSync()
    );
  }

  async getFeatures(): Promise<LicenceFeature[]> {
    if (!this.licence) return [];
    return this.licence.features.map((f) => ({ ...f }));
  }

  async isExpired(): Promise<boolean> {
    return this.isExpiredSync();
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.licence = null;
  }

  async stop(): Promise<void> {
    this.licence = null;
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        licenceLoaded: this.licence !== null,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Check whether the currently loaded licence has expired.
   *
   * Compares the current system time against the licence's
   * expiration date. Returns `true` if no licence is loaded.
   */
  private isExpiredSync(): boolean {
    if (!this.licence) return true;
    return Date.now() > this.licence.expiresAt.getTime();
  }
}
