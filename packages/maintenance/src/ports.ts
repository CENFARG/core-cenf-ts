/**
 * MaintenanceManager port interface — GDPR-compliant error reporting, PII scrubbing,
 * telemetry transport, and structured issue creation.
 *
 * Depend on this interface, inject adapters. Never import adapters directly
 * in business logic.
 *
 * Rules:
 *   - isConsentGranted() MUST return false until user explicitly opts in.
 *   - requestConsent() records explicit opt-in with timestamp.
 *   - revokeConsent() MUST purge all telemetry data for the user.
 *   - captureError() MUST scrub PII before returning ErrorReport.
 *   - reportError() SHOULD fire-and-forget — never block main flow.
 *   - sendTelemetry() MUST anonymize user identifiers.
 *
 * Security:
 *   - Consent is default-off. Never send data without consent.
 *   - PII is scrubbed at capture time, never after storage.
 *
 * @module managers/maintenance/ports
 */

import type { ErrorReport, ConsentResult, ReportResult } from './types.js';

/**
 * GDPR-compliant error capture, telemetry, and reporting contract.
 *
 * All CENF products that need auto error reporting consume this interface.
 * Concrete adapters provide consent management, PII-scrubbed capture,
 * telemetry transport, and structured issue creation.
 *
 * @ai-directive: Use MaintenanceManager to capture, scrub, and report errors
 *   with GDPR compliance. Always check isConsentGranted() before sending
 *   any telemetry data. Never send data without explicit user opt-in.
 *   captureError() MUST strip PII (email, tokens, passwords) before
 *   returning the ErrorReport. revokeConsent() MUST purge all user data.
 */
export interface MaintenanceManager {
  /**
   * Check whether the user has granted telemetry consent.
   *
   * @param appId - The application identifier.
   * @returns True if consent has been granted for this app, false otherwise (default).
   */
  isConsentGranted(appId: string): Promise<boolean>;

  /**
   * Record explicit user consent for telemetry.
   *
   * Stores the consent grant with timestamp. After this call,
   * isConsentGranted() MUST return true for this appId.
   *
   * @param appId - The application identifier.
   * @param userId - The user identifier granting consent.
   * @returns ConsentResult with status GRANTED and current timestamp.
   */
  requestConsent(appId: string, userId: string): Promise<ConsentResult>;

  /**
   * Revoke consent and purge all telemetry data (right to erasure).
   *
   * After this call:
   *   - isConsentGranted() MUST return false for this appId.
   *   - All stored telemetry data for this user MUST be deleted.
   *
   * @param appId - The application identifier.
   * @param userId - The user identifier revoking consent.
   * @returns ConsentResult with status REVOKED and current timestamp.
   */
  revokeConsent(appId: string, userId: string): Promise<ConsentResult>;

  /**
   * Capture an error with PII scrubbing and produce an ErrorReport.
   *
   * The implementation MUST:
   *   1. Extract stack trace from the exception.
   *   2. Scrub PII (email, token, password, credit card patterns).
   *   3. Return an ErrorReport with appId, message, and masked data.
   *
   * @param appId - The application identifier.
   * @param error - The error to capture.
   * @param context - Optional additional context (will be PII-scrubbed).
   * @returns PII-scrubbed ErrorReport ready for transport.
   */
  captureError(
    appId: string,
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<ErrorReport>;

  /**
   * Send an ErrorReport to the configured transport.
   *
   * SHOULD fire-and-forget. If the primary transport fails (e.g., GitHub
   * API unreachable), the adapter SHOULD fall back to secondary transport
   * (e.g., Discord webhook). MUST NOT crash the main application.
   *
   * @param report - An ErrorReport to transmit.
   * @returns ReportResult with success status and target identifier.
   */
  reportError(report: ErrorReport): Promise<ReportResult>;

  /**
   * Send telemetry metrics via transport.
   *
   * User identifiers MUST be anonymized. Metrics include: app_id,
   * version, OS, uptime, error_count.
   *
   * @param appId - The application identifier.
   * @param metrics - Dictionary of metric key-value pairs.
   */
  sendTelemetry(appId: string, metrics: Record<string, unknown>): Promise<void>;

  /**
   * Describe this manager contract for agent discovery.
   *
   * @returns JSON Schema describing the MaintenanceManager interface.
   */
  getJsonSchema(): Record<string, unknown>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const MAINTENANCE_PORT_VERSION = '0.1.0';
