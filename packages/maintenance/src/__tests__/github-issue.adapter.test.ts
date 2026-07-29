/**
 * Tests for GitHubIssueAdapter — GitHub Issues API adapter with dedup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubIssueAdapter } from '../adapters/github-issue.adapter.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(overrides?: Partial<ErrorReport>): ErrorReport {
  return {
    appId: 'my-app',
    message: 'Something went wrong',
    severity: ErrorSeverity.Error,
    timestamp: '2026-07-29T00:00:00Z',
    stackTrace: 'Error: Something went wrong\n    at main (index.ts:1:1)',
    version: '1.0.0',
    os: 'linux',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GitHubIssueAdapter
// ---------------------------------------------------------------------------

describe('GitHubIssueAdapter', () => {
  let adapter: GitHubIssueAdapter;

  beforeEach(() => {
    adapter = new GitHubIssueAdapter({
      repo: 'owner/repo',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reportError()', () => {
    it('returns success when GitHub API responds 201', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(true);
      expect(result.target).toBe('github');
      expect(mock).toHaveBeenCalledTimes(1);

      // Verify the URL and payload
      const callUrl = mock.mock.calls[0][0];
      expect(callUrl).toContain('/repos/owner/repo/issues');

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.title).toContain('[ERROR]');
      expect(callBody.labels).toContain('bug-automático');
    });

    it('deduplicates identical errors (same hash)', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const report = makeReport();

      // First call — should hit the API
      const result1 = await adapter.reportError(report);
      expect(result1.success).toBe(true);
      expect(mock).toHaveBeenCalledTimes(1);

      // Second call with same error — should be deduped
      const result2 = await adapter.reportError(report);
      expect(result2.success).toBe(true);
      expect(mock).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('returns failure when GitHub API responds 4xx', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('github');
      expect(result.error).toContain('Forbidden');
    });

    it('returns failure when fetch throws', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const report = makeReport();
      const result = await adapter.reportError(report);

      expect(result.success).toBe(false);
      expect(result.target).toBe('github');
      expect(result.error).toContain('Network error');
    });

    it('truncates title to 100 chars', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      const longMessage = 'x'.repeat(200);
      const report = makeReport({ message: longMessage });
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      expect(callBody.title.length).toBeLessThanOrEqual(128);
      expect(callBody.title).toContain(longMessage.slice(0, 100));
    });

    it('truncates stack trace in body to 4000 chars', async () => {
      const mock = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({}),
      });
      globalThis.fetch = mock as unknown as typeof globalThis.fetch;

      // Repeat something long enough that 4000-char truncation kicks in
      const longStack = 'abcdefghij'.repeat(500); // 5000 chars
      expect(longStack.length).toBe(5000);
      const report = makeReport({ stackTrace: longStack });
      await adapter.reportError(report);

      const callBody = JSON.parse(mock.mock.calls[0][1].body);
      // The body should contain the first 4000 chars of the stack
      expect(callBody.body).toContain('abcdefghij'.repeat(400));
      // The body should NOT contain chars from beyond 4000
      // Use a unique marker at position 4000+
      const marker = 'UNIQUE_MARKER_AFTER_4000';
      const longStackWithMarker = 'x'.repeat(4000) + marker;
      const report2 = makeReport({ stackTrace: longStackWithMarker });
      await adapter.reportError(report2);
      const callBody2 = JSON.parse(mock.mock.calls[1][1].body);
      expect(callBody2.body).toContain('x'.repeat(4000));
      expect(callBody2.body).not.toContain(marker);
    });
  });
});
