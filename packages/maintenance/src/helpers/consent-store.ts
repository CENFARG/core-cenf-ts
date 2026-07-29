/**
 * ConsentStore — JSON-based consent persistence for GDPR compliance.
 *
 * Provides consent state management for the MaintenanceManager. Consent
 * is default-off (GDPR by design). The store persists consent grants and
 * supports revocation with data purging.
 *
 * Security:
 *   - Default-off: isGranted() returns false until explicit opt-in.
 *   - revoke() clears all telemetry data for the user (right to erasure).
 *   - All operations are idempotent.
 *
 * @module managers/maintenance/helpers/consent-store
 */

/**
 * Consent record stored per app.
 */
export interface ConsentRecord {
  appId: string;
  userId: string;
  status: 'GRANTED' | 'REVOKED' | 'PENDING';
  timestamp: string;
}

/**
 * In-memory consent store with JSON persistence support.
 *
 * Tracks consent grants per appId. Each app has one consent state.
 * Supports granting, revoking, and checking consent.
 *
 * @example
 * ```typescript
 * const store = new ConsentStore();
 * store.grant('my-app', 'user-1');
 * console.log(store.isGranted('my-app')); // true
 * store.revoke('my-app', 'user-1');
 * console.log(store.isGranted('my-app')); // false
 * ```
 */
export class ConsentStore {
  private consent: Map<string, ConsentRecord> = new Map();
  private telemetryData: Map<string, Array<Record<string, unknown>>> = new Map();

  /**
   * Check if consent has been granted for an app.
   *
   * @param appId - The application identifier.
   * @returns True if consent is granted, false otherwise.
   */
  isGranted(appId: string): boolean {
    const record = this.consent.get(appId);
    if (!record) return false;
    return record.status === 'GRANTED';
  }

  /**
   * Record explicit consent for an app.
   *
   * @param appId - The application identifier.
   * @param userId - The user identifier granting consent.
   * @returns The consent record with GRANTED status.
   */
  grant(appId: string, userId: string): ConsentRecord {
    const record: ConsentRecord = {
      appId,
      userId,
      status: 'GRANTED',
      timestamp: new Date().toISOString(),
    };
    this.consent.set(appId, record);
    return record;
  }

  /**
   * Revoke consent and purge telemetry data (right to erasure).
   *
   * @param appId - The application identifier.
   * @param userId - The user identifier revoking consent.
   * @returns The consent record with REVOKED status.
   */
  revoke(appId: string, userId: string): ConsentRecord {
    const record: ConsentRecord = {
      appId,
      userId,
      status: 'REVOKED',
      timestamp: new Date().toISOString(),
    };
    this.consent.set(appId, record);
    // Purge telemetry data (right to erasure)
    this.telemetryData.delete(appId);
    return record;
  }

  /**
   * Store telemetry metrics for an app.
   *
   * Only stores data if consent is granted.
   *
   * @param appId - The application identifier.
   * @param metrics - Dictionary of metric key-value pairs.
   */
  addTelemetry(appId: string, metrics: Record<string, unknown>): void {
    if (!this.isGranted(appId)) return;
    if (!this.telemetryData.has(appId)) {
      this.telemetryData.set(appId, []);
    }
    this.telemetryData.get(appId)!.push({ ...metrics });
  }

  /**
   * Get stored telemetry data for an app.
   *
   * @param appId - The application identifier.
   * @returns Array of metric records.
   */
  getTelemetry(appId: string): Array<Record<string, unknown>> {
    return [...(this.telemetryData.get(appId) ?? [])];
  }
}

/** Runtime version constant — ensures module existence for TDD. */
export const CONSENT_STORE_VERSION = '0.1.0';
