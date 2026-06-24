/**
 * In-memory feature flag adapter — programmatic flag store for testing.
 *
 * Implements the FeatureFlagManager port with a static FlagConfig.
 * Supports simple boolean flags and percentage-based rollout.
 *
 * @module managers/feature-flag/adapters/memory.adapter
 */

import type { FeatureFlagManager } from '../ports.js';
import type { FeatureFlag, FlagConfig } from '../types.js';
import type { HealthStatus } from '../../../shared/types.js';

// ---------------------------------------------------------------------------
// MemoryFeatureFlagAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory feature flag adapter backed by a static configuration.
 *
 * Supports boolean flags and percentage-based rollout using a
 * deterministic hash of the flag name + userId.
 *
 * Use this adapter:
 * - In unit tests where a real flag backend is not available
 * - For programmatic flag injection in CI/CD environments
 * - As a fallback when the YAML flag source is unavailable
 */
export class MemoryFeatureFlagAdapter implements FeatureFlagManager {
  private flagMap = new Map<string, FeatureFlag>();
  private readonly defaultEnabled: boolean;
  private readonly flags: FeatureFlag[];

  constructor(config: FlagConfig) {
    this.defaultEnabled = config.defaultEnabled ?? false;
    this.flags = config.flags;
    for (const flag of config.flags) {
      this.flagMap.set(flag.name, flag);
    }
  }

  // -----------------------------------------------------------------------
  // FeatureFlagManager
  // -----------------------------------------------------------------------

  async isEnabled(flag: string): Promise<boolean> {
    const def = this.flagMap.get(flag);
    if (!def) return this.defaultEnabled;
    // Percentage rollout requires userId context — return false without it.
    if (def.rolloutPercentage !== undefined) return false;
    return def.enabled;
  }

  async isEnabledForUser(flag: string, userId: string): Promise<boolean> {
    const def = this.flagMap.get(flag);
    if (!def) return this.defaultEnabled;
    if (def.rolloutPercentage !== undefined) {
      return this.evaluatePercentage(def.name, userId, def.rolloutPercentage);
    }
    return def.enabled;
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return [...this.flags];
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Flags are already loaded from the config at construction time.
    // No async initialization needed.
  }

  async stop(): Promise<void> {
    // No resources to release.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        flagsLoaded: this.flags.length,
        defaultEnabled: this.defaultEnabled,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Deterministic percentage rollout evaluation.
   *
   * Uses a FNV-1a-style hash of `flagName + ":" + userId` modulo 100
   * to assign each user a bucket (0-99). If the bucket falls within
   * the rollout percentage, the flag is enabled for that user.
   *
   * @returns `true` if the user falls within the rollout percentage.
   */
  private evaluatePercentage(
    flagName: string,
    userId: string,
    percentage: number,
  ): boolean {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;
    const bucket = this.hashUserFlag(flagName, userId) % 100;
    return bucket < percentage;
  }

  /**
   * Simple FNV-1a-style hash for deterministic bucket assignment.
   *
   * The same `(flagName, userId)` pair always produces the same bucket.
   */
  private hashUserFlag(flagName: string, userId: string): number {
    const input = `${flagName}:${userId}`;
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV prime
      // Keep it within safe integer range
      hash = hash >>> 0;
    }
    return hash;
  }
}
