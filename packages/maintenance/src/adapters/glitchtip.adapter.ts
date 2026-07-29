/**
 * GlitchTipAdapter — sends error reports to a self-hosted GlitchTip instance
 * using the Sentry-compatible protocol (Sentry v7).
 */

import { ErrorSeverity, type ErrorReport, type ReportResult } from '../types.js';
import { randomBytes } from 'node:crypto';

/** Configuration for GlitchTipAdapter */
export interface GlitchTipConfig {
  /** Sentry-compatible DSN: {protocol}://{public-key}@{host}/{project-id} */
  dsn: string;
}

/** Parsed DSN components */
interface ParsedDsn {
  protocol: string;
  publicKey: string;
  host: string;
  port?: number;
  projectId: string;
}

const SEVERITY_MAP: Record<ErrorSeverity, string> = {
  [ErrorSeverity.Trace]: 'debug',
  [ErrorSeverity.Debug]: 'debug',
  [ErrorSeverity.Info]: 'info',
  [ErrorSeverity.Warning]: 'warning',
  [ErrorSeverity.Error]: 'error',
  [ErrorSeverity.Critical]: 'fatal',
};

/** Adapter that sends error reports to GlitchTip via the Sentry v7 protocol. */
export class GlitchTipAdapter {
  private readonly dsn: ParsedDsn;

  constructor(config: GlitchTipConfig) {
    this.dsn = parseDsn(config.dsn);
  }

  async reportError(report: ErrorReport): Promise<ReportResult> {
    try {
      const eventId = randomBytes(16).toString('hex');
      const payload = this.buildPayload(report, eventId);
      const url = `${this.dsn.protocol}://${this.dsn.host}${this.dsn.port ? `:${this.dsn.port}` : ''}/api/${String(this.dsn.projectId)}/store/`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': [
            `Sentry sentry_version=7`,
            `sentry_client=cenf-maintenance/0.1.0`,
            `sentry_key=${this.dsn.publicKey}`,
          ].join(', '),
        },
        body: JSON.stringify(payload),
      });

      if (response.status >= 400) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          target: 'glitchtip',
          error: (body as { detail?: string }).detail ?? `HTTP ${response.status}`,
        };
      }

      return { success: true, target: 'glitchtip' };
    } catch (err) {
      return {
        success: false,
        target: 'glitchtip',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Build a Sentry v7-compatible event payload. */
  private buildPayload(report: ErrorReport, eventId: string): Record<string, unknown> {
    const exception: Record<string, unknown> = {
      type: report.message,
      value: report.message,
    };

    if (report.stackTrace) {
      exception['stacktrace'] = {
        frames: parseStackFrames(report.stackTrace),
      };
    }

    return {
      event_id: eventId,
      message: report.message,
      culprit: report.appId,
      level: SEVERITY_MAP[report.severity] ?? 'error',
      platform: 'node',
      timestamp: report.timestamp,
      tags: {
        app_id: report.appId,
        version: report.version ?? 'unknown',
      },
      extra: {
        os: report.os,
        ...(report.context ?? {}),
      },
      'sentry.interfaces.Exception': {
        values: [exception],
      },
    };
  }
}

/** Parse a Sentry-compatible DSN into its components. */
function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn.startsWith('http') ? dsn : `https://${dsn}`);
  const [publicKey] = (url.username || url.hostname.split('@')[0] || '').split('@');
  const projectId = url.pathname.replace(/^\//, '').split('/')[0] || '0';
  const host = url.hostname;
  const protocol = (url.protocol.replace(':', '') || 'https') as ParsedDsn['protocol'];

  return {
    protocol,
    publicKey: publicKey || 'unknown',
    host,
    port: url.port ? Number(url.port) : undefined,
    projectId,
  };
}

/** Parse a stack trace string into Sentry frame objects. */
function parseStackFrames(stackTrace: string): Array<{ filename: string; function: string; lineno?: number; colno?: number }> {
  const lines = stackTrace.split('\n');
  const frames: Array<{ filename: string; function: string; lineno?: number; colno?: number }> = [];

  for (const line of lines) {
    // Match: "    at functionName (file:line:col)" or "    at file:line:col"
    const match = line.match(/^\s+at\s+(?:(.+?)\s+\()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/);
    if (match) {
      frames.push({
        function: match[1] || '<anonymous>',
        filename: match[2] || '',
        ...(match[3] ? { lineno: Number(match[3]) } : {}),
        ...(match[4] ? { colno: Number(match[4]) } : {}),
      });
    }
  }

  return frames;
}
