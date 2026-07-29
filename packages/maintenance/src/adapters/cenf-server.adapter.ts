/**
 * CENFServerAdapter — transports error reports to a CENF Server REST API.
 */

import { type ErrorReport, type ReportResult } from '../types.js';

/** Configuration for CENFServerAdapter */
export interface CENFServerConfig {
  serverUrl: string;
  /** API token for authenticated requests */
  apiToken?: string;
}

/** Adapter that sends error reports and telemetry to a CENF Server REST API. */
export class CENFServerAdapter {
  private readonly config: Required<Pick<CENFServerConfig, 'serverUrl'>> &
    Pick<CENFServerConfig, 'apiToken'>;

  constructor(config: CENFServerConfig) {
    this.config = {
      serverUrl: config.serverUrl.replace(/\/+$/, ''),
      apiToken: config.apiToken,
    };
  }

  async reportError(report: ErrorReport): Promise<ReportResult> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiToken) {
        headers['Authorization'] = `Bearer ${this.config.apiToken}`;
      }

      const response = await fetch(`${this.config.serverUrl}/api/v1/errors`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          appId: report.appId,
          message: report.message,
          severity: report.severity,
          timestamp: report.timestamp,
          stackTrace: report.stackTrace,
          version: report.version,
          os: report.os,
          context: report.context,
        }),
      });

      if (response.status >= 400) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          target: 'cenf-server',
          error: (body as { error?: string }).error ?? `HTTP ${response.status}`,
        };
      }

      return { success: true, target: 'cenf-server' };
    } catch (err) {
      return {
        success: false,
        target: 'cenf-server',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendTelemetry(appId: string, metrics: Record<string, unknown>): Promise<void> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiToken) {
        headers['Authorization'] = `Bearer ${this.config.apiToken}`;
      }

      await fetch(`${this.config.serverUrl}/api/v1/telemetry`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ appId, metrics }),
      });
    } catch {
      // Fire-and-forget telemetry; failures are silently ignored
    }
  }
}
