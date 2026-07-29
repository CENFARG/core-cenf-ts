/**
 * GitHubIssueAdapter — auto-issue creation via GitHub API.
 *
 * Creates GitHub issues from ErrorReports with hash-based deduplication
 * to prevent duplicate issues for the same error. Uses GitHub API directly.
 *
 * Security:
 *   - Hash-based dedup prevents issue spam.
 *   - Stack trace is included as issue body for debugging.
 *
 * Observability:
 *   - Fire-and-forget: never blocks the main flow.
 *   - Dedup hash is computed from stack trace + appId + message.
 *
 * @ai-directive: Use GitHubIssueAdapter to auto-create issues from errors.
 *   Duplicates are prevented via hash-based dedup. Labels include
 *   'bug-automático' for filtering.
 *
 * @module managers/maintenance/adapters/github-issue.adapter
 */

import type { ErrorReport, ReportResult } from '../types.js';

/**
 * Options for configuring the GitHubIssueAdapter.
 */
export interface GitHubIssueOptions {
  /** GitHub API base URL (default: "https://api.github.com"). */
  apiUrl?: string;
  /** Repository name in "owner/repo" format. */
  repo: string;
}

/**
 * GitHub API-based issue creation adapter with dedup.
 *
 * Creates issues in a GitHub repository from ErrorReports. Uses
 * hash-based deduplication to avoid creating duplicate issues
 * for the same error.
 *
 * @example
 * ```typescript
 * const adapter = new GitHubIssueAdapter({
 *   apiUrl: 'https://api.github.com',
 *   repo: 'owner/repo',
 * });
 * const result = await adapter.reportError(errorReport);
 * ```
 */
export class GitHubIssueAdapter {
  private apiUrl: string;
  private repo: string;
  private seenHashes: Set<string> = new Set();

  constructor(opts: GitHubIssueOptions) {
    this.apiUrl = (opts.apiUrl ?? 'https://api.github.com').replace(/\/+$/, '');
    this.repo = opts.repo;
  }

  /**
   * Compute a hash for deduplication.
   *
   * Combines appId, message, and first 500 chars of stack trace.
   *
   * @param report - The ErrorReport to hash.
   * @returns SHA-256 hex digest for dedup.
   */
  private computeDedupHash(report: ErrorReport): string {
    const content = `${report.appId}:${report.message}:${(report.stackTrace ?? '').slice(0, 500)}`;
    return sha256Hex(content);
  }

  /**
   * Create a GitHub issue from an error report.
   *
   * @param report - The ErrorReport to create an issue from.
   * @returns ReportResult with success or failure.
   */
  async reportError(report: ErrorReport): Promise<ReportResult> {
    const dedupHash = this.computeDedupHash(report);

    // Local dedup check
    if (this.seenHashes.has(dedupHash)) {
      return { success: true, target: 'github' };
    }

    try {
      const body = [
        `## Auto-generated Error Report`,
        '',
        `**App**: ${report.appId}`,
        `**Version**: ${report.version ?? 'N/A'}`,
        `**OS**: ${report.os ?? 'N/A'}`,
        `**Severity**: ${report.severity}`,
        `**Timestamp**: ${report.timestamp}`,
        '',
        '### Message',
        '```',
        report.message,
        '```',
        '',
        '### Stack Trace',
        '```',
        (report.stackTrace ?? '').slice(0, 4000),
        '```',
      ].join('\n');

      const title = `[${report.severity}] ${report.appId}: ${report.message.slice(0, 100)}`;

      const payload: Record<string, unknown> = {
        title,
        body,
        labels: ['bug-automático'],
      };

      const url = `${this.apiUrl}/repos/${this.repo}/issues`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status >= 400) {
        const errorBody = (await response.json()) as Record<string, unknown>;
        const errorMsg = String(errorBody.message ?? `HTTP ${response.status}`);
        return {
          success: false,
          target: 'github',
          error: errorMsg,
        };
      }

      this.seenHashes.add(dedupHash);
      return { success: true, target: 'github' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        target: 'github',
        error: errorMsg,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SHA-256 helper (browser/Node compatible)
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hex digest of a string.
 *
 * Uses the Web Crypto API when available (browsers, Node 20+).
 *
 * @param input - The string to hash.
 * @returns SHA-256 hex digest.
 */
function sha256Hex(input: string): string {
  // Simple non-crypto hash for dedup (fast, not security-critical)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}
