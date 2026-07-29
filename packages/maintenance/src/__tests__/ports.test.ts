/**
 * Tests for MaintenanceManager port interface.
 */

import { describe, it, expect } from 'vitest';
import { MAINTENANCE_PORT_VERSION } from '../ports.js';
import type { MaintenanceManager } from '../ports.js';
import { ErrorSeverity } from '../types.js';
import type { ErrorReport, ConsentResult, ReportResult } from '../types.js';

describe('MaintenanceManager interface', () => {
  it('has a version constant', () => {
    expect(MAINTENANCE_PORT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('defines the required method signatures (compile-time check)', () => {
    // Create a minimal implementation to verify the interface is sound
    const impl: MaintenanceManager = {
      isConsentGranted: async (_appId: string) => false,
      requestConsent: async (_appId: string, _userId: string) => {
        const r: ConsentResult = { appId: _appId, userId: _userId, status: 'GRANTED', timestamp: '' };
        return r;
      },
      revokeConsent: async (_appId: string, _userId: string) => {
        const r: ConsentResult = { appId: _appId, userId: _userId, status: 'REVOKED', timestamp: '' };
        return r;
      },
      captureError: async (_appId: string, _error: Error, _context?: Record<string, unknown>) => {
        const r: ErrorReport = { appId: _appId, message: 'test', severity: ErrorSeverity.Error, timestamp: '' };
        return r;
      },
      reportError: async (_report: ErrorReport) => {
        const r: ReportResult = { success: true, target: 'test' };
        return r;
      },
      sendTelemetry: async (_appId: string, _metrics: Record<string, unknown>) => {},
      getJsonSchema: () => ({}),
    };

    expect(typeof impl.isConsentGranted).toBe('function');
    expect(typeof impl.requestConsent).toBe('function');
    expect(typeof impl.revokeConsent).toBe('function');
    expect(typeof impl.captureError).toBe('function');
    expect(typeof impl.reportError).toBe('function');
    expect(typeof impl.sendTelemetry).toBe('function');
    expect(typeof impl.getJsonSchema).toBe('function');
  });
});
