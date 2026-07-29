/**
 * InMemoryMaintenanceAdapter — dict-backed MaintenanceManager test double.
 *
 * Provides a lightweight, zero-I/O adapter for unit testing components that
 * depend on MaintenanceManager. Consents, errors, and telemetry are stored
 * in memory and exposed via test helper methods for assertions.
 *
 * Security: This adapter performs regex-based PII scrubbing. NEVER use
 *     it in production — it's a test-only adapter.
 *
 * @module managers/maintenance/adapters/memory.adapter
 */

import type { MaintenanceManager } from '../ports.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport, ConsentResult, ReportResult } from '../types.js';
import { ConsentStore } from '../helpers/consent-store.js';
import { scrubPii } from '../helpers/pii-scrubber.js';

/**
 * Dict-backed MaintenanceManager test double.
 *
 * Stores consents, errors, and metrics in memory for test assertions.
 * All operations are fire-and-forget — never block or raise.
 *
 * @example
 * ```typescript
 * const adapter = new InMemoryMaintenanceAdapter();
 * await adapter.requestConsent('my-app', 'user-1');
 * const report = await adapter.captureError('my-app', new Error('fail'), { key: 'val' });
 * await adapter.reportError(report);
 * const errors = adapter.getCapturedErrors('my-app');
 * const reported = adapter.getReportedErrors();
 * ```
 */
export class InMemoryMaintenanceAdapter implements MaintenanceManager {
  private consentStore = new ConsentStore();
  private capturedErrors = new Map<string, ErrorReport[]>();
  private reportedErrors: ErrorReport[] = [];

  // -----------------------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------------------

  /**
   * Get all captured errors for an app (test helper).
   *
   * @param appId - The application identifier.
   * @returns Captured errors for the app.
   */
  getCapturedErrors(appId: string): ErrorReport[] {
    return [...(this.capturedErrors.get(appId) ?? [])];
  }

  /**
   * Get all reported errors (test helper).
   *
   * @returns All errors that passed through reportError().
   */
  getReportedErrors(): ErrorReport[] {
    return [...this.reportedErrors];
  }

  /**
   * Get all captured telemetry metrics for an app (test helper).
   *
   * @param appId - The application identifier.
   * @returns Telemetry metric batches for the app.
   */
  getCapturedMetrics(appId: string): Array<Record<string, unknown>> {
    return this.consentStore.getTelemetry(appId);
  }

  // -----------------------------------------------------------------------
  // MaintenanceManager
  // -----------------------------------------------------------------------

  async isConsentGranted(appId: string): Promise<boolean> {
    return this.consentStore.isGranted(appId);
  }

  async requestConsent(appId: string, userId: string): Promise<ConsentResult> {
    const record = this.consentStore.grant(appId, userId);
    return {
      appId: record.appId,
      userId: record.userId,
      status: 'GRANTED',
      timestamp: record.timestamp,
    };
  }

  async revokeConsent(appId: string, userId: string): Promise<ConsentResult> {
    const record = this.consentStore.revoke(appId, userId);
    return {
      appId: record.appId,
      userId: record.userId,
      status: 'REVOKED',
      timestamp: record.timestamp,
    };
  }

  async captureError(
    appId: string,
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<ErrorReport> {
    const stack = error.stack ?? '';
    const scrubbedStack = scrubPii(stack);
    const message = scrubPii(error.message);

    let scrubbedContext: Record<string, unknown> | undefined;
    if (context) {
      scrubbedContext = {};
      for (const [key, value] of Object.entries(context)) {
        scrubbedContext[key] = typeof value === 'string' ? scrubPii(value) : value;
      }
    }

    const report: ErrorReport = {
      appId,
      message,
      stackTrace: scrubbedStack,
      version: '0.0.0',
      os: detectOs(),
      timestamp: new Date().toISOString(),
      severity: ErrorSeverity.Error,
      context: scrubbedContext,
    };

    if (!this.capturedErrors.has(appId)) {
      this.capturedErrors.set(appId, []);
    }
    this.capturedErrors.get(appId)!.push(report);
    return report;
  }

  async reportError(report: ErrorReport): Promise<ReportResult> {
    const granted = await this.isConsentGranted(report.appId);
    if (!granted) {
      return {
        success: false,
        target: 'in-memory',
        error: 'Consent not granted for this app',
      };
    }

    this.reportedErrors.push(report);
    return { success: true, target: 'in-memory' };
  }

  async sendTelemetry(appId: string, metrics: Record<string, unknown>): Promise<void> {
    this.consentStore.addTelemetry(appId, { ...metrics });
  }

  getJsonSchema(): Record<string, unknown> {
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'MaintenanceManager',
      type: 'object',
      description:
        'Manages GDPR-compliant error reporting, PII scrubbing, telemetry transport, and structured issue creation.',
      properties: {
        isConsentGranted: {
          type: 'object',
          description: 'Check whether the user has granted telemetry consent.',
        },
        requestConsent: {
          type: 'object',
          description: 'Record explicit user consent for telemetry.',
        },
        revokeConsent: {
          type: 'object',
          description: 'Revoke consent and purge all telemetry data.',
        },
        captureError: {
          type: 'object',
          description: 'Capture an error with PII scrubbing.',
        },
        reportError: {
          type: 'object',
          description: 'Send an ErrorReport to the configured transport.',
        },
        sendTelemetry: {
          type: 'object',
          description: 'Send telemetry metrics.',
        },
      },
    };
  }
}

// ---------------------------------------------------------------------------
// OS detection
// ---------------------------------------------------------------------------

/**
 * Detect the current operating system.
 *
 * @returns One of "windows", "macos", "linux".
 */
function detectOs(): string {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform.startsWith('win')) return 'windows';
    if (process.platform === 'darwin') return 'macos';
    return 'linux';
  }
  return 'linux';
}
