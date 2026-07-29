import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryLicenceAdapter } from '../adapters/memory.adapter.js';
import type { LicenceManager } from '../ports.js';
import type { Licence } from '../types.js';

// ---------------------------------------------------------------------------
// InMemoryLicenceAdapter
// ---------------------------------------------------------------------------

describe('InMemoryLicenceAdapter', () => {
  describe('valid licence scenario', () => {
    let manager: LicenceManager;

    // A fixed "current time" during the valid period of the hardcoded licence
    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      manager = new InMemoryLicenceAdapter();
      await manager.start();
    });

    afterEach(async () => {
      await manager.stop();
      vi.useRealTimers();
    });

    it('loadLicence() returns a licence with provided key', async () => {
      const lic = await manager.loadLicence('KEY-001');
      expect(lic.key).toBe('KEY-001');
      expect(lic.status).toBe('valid');
      expect(lic.holder).toBe('CENF Test');
    });

    it('loadLicence() returns licence with features', async () => {
      const lic = await manager.loadLicence('KEY-001');
      expect(lic.features).toHaveLength(3);
      const names = lic.features.map((f) => f.name).sort();
      expect(names).toEqual(['advanced-metrics', 'audit-log', 'sso']);
    });

    it('validateLicence() returns true for valid licence', async () => {
      await manager.loadLicence('KEY-001');
      expect(await manager.validateLicence()).toBe(true);
    });

    it('validateLicence() returns false before loading a licence', async () => {
      expect(await manager.validateLicence()).toBe(false);
    });

    it('getFeatures() returns features after load', async () => {
      await manager.loadLicence('KEY-001');
      const features = await manager.getFeatures();
      expect(features).toHaveLength(3);
    });

    it('getFeatures() returns empty before loading', async () => {
      const features = await manager.getFeatures();
      expect(features).toEqual([]);
    });

    it('isExpired() returns false for non-expired licence', async () => {
      await manager.loadLicence('KEY-001');
      expect(await manager.isExpired()).toBe(false);
    });

    it('loadLicence() can be called multiple times', async () => {
      const lic1 = await manager.loadLicence('KEY-A');
      const lic2 = await manager.loadLicence('KEY-B');
      expect(lic1.key).toBe('KEY-A');
      expect(lic2.key).toBe('KEY-B');
    });
  });

  // -----------------------------------------------------------------------
  // Expired licence scenario
  // -----------------------------------------------------------------------

  describe('expired licence scenario', () => {
    it('isExpired() returns true when current date is past expiry', async () => {
      vi.useFakeTimers();
      try {
        // Hardcoded licence expires 2027-12-31 — advance past that
        vi.setSystemTime(new Date('2028-06-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        await mgr.loadLicence('OLD-KEY');
        expect(await mgr.isExpired()).toBe(true);
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('validateLicence() returns false for expired licence', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2028-06-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        await mgr.loadLicence('OLD-KEY');
        expect(await mgr.validateLicence()).toBe(false);
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Custom licence override
  // -----------------------------------------------------------------------

  describe('custom licence override', () => {
    it('accepts a pre-built licence in the constructor', async () => {
      const customLicence: Licence = {
        key: 'CUSTOM',
        status: 'trial',
        issuedAt: new Date('2026-07-01'),
        expiresAt: new Date('2026-08-01'),
        features: [{ name: 'premium', enabled: true, limits: { maxProjects: 3 } }],
        holder: 'Trial User',
      };

      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter(customLicence);
        await mgr.start();

        // loadLicence should NOT overwrite a pre-set licence
        const lic = await mgr.loadLicence('CUSTOM');
        expect(lic.key).toBe('CUSTOM');
        expect(lic.status).toBe('trial');
        expect(await mgr.isExpired()).toBe(false);
        expect(await mgr.validateLicence()).toBe(true);
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() initializes clean state', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        const h = await mgr.health();
        expect(h.status).toBe('healthy');
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('stop() clears licence', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        await mgr.loadLicence('KEY');
        expect(await mgr.validateLicence()).toBe(true);
        await mgr.stop();
        // After stop, should be clean
        expect(await mgr.validateLicence()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('health() reports adapter info', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        await mgr.loadLicence('KEY-001');

        const h = await mgr.health();
        expect(h.status).toBe('healthy');
        expect(h.details).toHaveProperty('adapter', 'memory');
        expect(h.details).toHaveProperty('licenceLoaded', true);
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('health() reports no licence before load', async () => {
      vi.useFakeTimers();
      try {
        const mgr = new InMemoryLicenceAdapter();
        await mgr.start();
        const h = await mgr.health();
        expect(h.details).toHaveProperty('licenceLoaded', false);
        await mgr.stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
