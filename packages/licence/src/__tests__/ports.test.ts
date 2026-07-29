import { describe, it, expect } from 'vitest';
import {
  LICENCE_PORT_VERSION,
  type LicenceManager,
} from '../ports.js';
import type { Licence, LicenceFeature, LicenceStatus } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of LicenceManager for contract verification
// ---------------------------------------------------------------------------

class TestLicenceManager implements LicenceManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async loadLicence(_key: string): Promise<Licence> {
    return {
      key: 'test-licence',
      status: 'valid',
      issuedAt: new Date('2026-01-01'),
      expiresAt: new Date('2027-12-31'),
      features: [{ name: 'audit-log', enabled: true }],
      holder: 'Test Corp',
    };
  }

  async validateLicence(): Promise<boolean> {
    return true;
  }

  async getFeatures(): Promise<LicenceFeature[]> {
    return [{ name: 'audit-log', enabled: true }];
  }

  async isExpired(): Promise<boolean> {
    return false;
  }
}

// ---------------------------------------------------------------------------
// LicenceManager port contract
// ---------------------------------------------------------------------------

describe('LicenceManager port', () => {
  it('exports a runtime version constant', () => {
    expect(LICENCE_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: LicenceManager = new TestLicenceManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestLicenceManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('loadLicence() returns a Licence with required fields', async () => {
    const mgr = new TestLicenceManager();
    const lic = await mgr.loadLicence('test-key');
    expect(lic.key).toBe('test-licence');
    expect(lic.status).toBe('valid');
    expect(lic.holder).toBe('Test Corp');
    expect(lic.features).toHaveLength(1);
  });

  it('validateLicence() returns true by default', async () => {
    const mgr = new TestLicenceManager();
    expect(await mgr.validateLicence()).toBe(true);
  });

  it('getFeatures() returns available features', async () => {
    const mgr = new TestLicenceManager();
    const features = await mgr.getFeatures();
    expect(features).toHaveLength(1);
    expect(features[0]!.name).toBe('audit-log');
  });

  it('isExpired() returns false by default', async () => {
    const mgr = new TestLicenceManager();
    expect(await mgr.isExpired()).toBe(false);
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestLicenceManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Licence types
// ---------------------------------------------------------------------------

describe('Licence types', () => {
  it('LicenceStatus accepts all valid statuses', () => {
    const statuses: LicenceStatus[] = ['valid', 'expired', 'invalid', 'trial'];
    expect(statuses).toHaveLength(4);
  });

  it('LicenceFeature has name and enabled', () => {
    const feature: LicenceFeature = {
      name: 'advanced-metrics',
      enabled: true,
    };
    expect(feature.name).toBe('advanced-metrics');
    expect(feature.enabled).toBe(true);
  });

  it('LicenceFeature accepts optional limits', () => {
    const feature: LicenceFeature = {
      name: 'sso',
      enabled: true,
      limits: { maxUsers: 100 },
    };
    expect(feature.limits).toEqual({ maxUsers: 100 });
  });

  it('Licence has all required fields', () => {
    const licence: Licence = {
      key: 'lic-001',
      status: 'valid',
      issuedAt: new Date('2026-06-01'),
      expiresAt: new Date('2027-06-01'),
      features: [
        { name: 'audit-log', enabled: true },
      ],
      holder: 'Acme Inc',
    };
    expect(licence.key).toBe('lic-001');
    expect(licence.status).toBe('valid');
    expect(licence.holder).toBe('Acme Inc');
    expect(licence.features).toHaveLength(1);
  });

  it('Licence with expired status', () => {
    const licence: Licence = {
      key: 'expired-lic',
      status: 'expired',
      issuedAt: new Date('2024-01-01'),
      expiresAt: new Date('2025-01-01'),
      features: [],
      holder: 'Old Corp',
    };
    expect(licence.status).toBe('expired');
    expect(licence.features).toEqual([]);
  });

  it('Licence with trial status', () => {
    const licence: Licence = {
      key: 'trial-lic',
      status: 'trial',
      issuedAt: new Date('2026-07-01'),
      expiresAt: new Date('2026-08-01'),
      features: [{ name: 'premium', enabled: true }],
      holder: 'Trial User',
    };
    expect(licence.status).toBe('trial');
    expect(licence.holder).toBe('Trial User');
  });
});
