/**
 * LicenceManager-specific types.
 *
 * Types for licence validation, features, and status tracking.
 *
 * @module managers/licence/types
 */

// ---------------------------------------------------------------------------
// LicenceStatus — lifecycle state of a licence
// ---------------------------------------------------------------------------

/**
 * The current lifecycle status of a licence.
 *
 * - `valid`: Licence is active and all features are available.
 * - `expired`: Licence has passed its expiration date.
 * - `invalid`: Licence key could not be verified.
 * - `trial`: Limited-time trial with restricted features.
 */
export type LicenceStatus = 'valid' | 'expired' | 'invalid' | 'trial';

// ---------------------------------------------------------------------------
// LicenceFeature — a single gated capability
// ---------------------------------------------------------------------------

/**
 * A feature controlled by the licence.
 *
 * Features can be toggled on/off via `enabled` and may have
 * numeric limits (e.g., max users, max storage) defined in the
 * `limits` map.
 */
export interface LicenceFeature {
  /** Name of the feature (e.g., "audit-log", "sso"). */
  name: string;

  /** Whether the feature is currently enabled by the licence. */
  enabled: boolean;

  /** Optional numeric limits for this feature (e.g., maxUsers, maxProjects). */
  limits?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Licence — the full licence document
// ---------------------------------------------------------------------------

/**
 * A software licence document.
 *
 * Contains the licence key, status, validity period,
 * granted features, and the licence holder's identity.
 */
export interface Licence {
  /** The unique licence key. */
  key: string;

  /** Current status of the licence. */
  status: LicenceStatus;

  /** Date when the licence was issued. */
  issuedAt: Date;

  /** Date when the licence expires. */
  expiresAt: Date;

  /** Features granted by this licence. */
  features: LicenceFeature[];

  /** Name of the entity holding the licence. */
  holder: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const LICENCE_TYPES_VERSION = '0.1.0';
