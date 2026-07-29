/**
 * DiscordAlertAdapter — sends error reports as rich embed messages
 * to a Discord webhook URL.
 */

import { ErrorSeverity, type ErrorReport, type ReportResult } from '../types.js';
import { scrubPii } from '../helpers/pii-scrubber.js';

/** Configuration for DiscordAlertAdapter */
export interface DiscordAlertConfig {
  webhookUrl: string;
  /** Discord username override (default: 'CENF Error Reporter') */
  username?: string;
}

const SEVERITY_COLORS: Record<ErrorSeverity, number> = {
  [ErrorSeverity.Trace]: 0xCCCCCC,    // Light gray
  [ErrorSeverity.Debug]: 0x808080,    // Gray
  [ErrorSeverity.Info]: 0x0000FF,     // Blue
  [ErrorSeverity.Warning]: 0xFFFF00,  // Yellow
  [ErrorSeverity.Error]: 0xFF0000,    // Red
  [ErrorSeverity.Critical]: 0x8B0000, // Dark red
};

/** Adapter that posts error reports as Discord embed messages via webhook. */
export class DiscordAlertAdapter {
  private readonly config: Required<DiscordAlertConfig>;

  constructor(config: DiscordAlertConfig) {
    this.config = {
      webhookUrl: config.webhookUrl,
      username: config.username ?? 'CENF Error Reporter',
    };
  }

  async reportError(report: ErrorReport): Promise<ReportResult> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.username,
          embeds: [
            {
              title: `🚨 ${report.appId} — ${report.message}`,
              color: SEVERITY_COLORS[report.severity],
              description: this.formatDescription(report),
              timestamp: report.timestamp,
              fields: [
                { name: 'Severity', value: report.severity, inline: true },
                { name: 'Version', value: report.version || 'N/A', inline: true },
                { name: 'OS', value: report.os || 'N/A', inline: true },
              ],
            },
          ],
        }),
      });

      if (response.status >= 400) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          target: 'discord',
          error: (body as { message?: string }).message ?? `HTTP ${response.status}`,
        };
      }

      return { success: true, target: 'discord' };
    } catch (err) {
      return {
        success: false,
        target: 'discord',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Build the embed description from a report, truncating stack trace to 2000 chars. */
  private formatDescription(report: ErrorReport): string {
    const stack = (report.stackTrace ?? '').slice(0, 2000);
    const user = scrubPii(String(report.context?.['userEmail'] ?? ''));
    return [
      `**${report.message}**`,
      user ? `User: ${user}` : '',
      '',
      stack ? `\`\`\`\n${stack}\n\`\`\`` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
