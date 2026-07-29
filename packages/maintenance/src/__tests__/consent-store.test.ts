/**
 * Tests for ConsentStore helper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentStore, CONSENT_STORE_VERSION } from '../helpers/consent-store.js';

describe('ConsentStore', () => {
  let store: ConsentStore;

  beforeEach(() => {
    store = new ConsentStore();
  });

  describe('isGranted()', () => {
    it('returns false for unknown app', () => {
      expect(store.isGranted('unknown')).toBe(false);
    });

    it('returns false before consent is granted', () => {
      expect(store.isGranted('my-app')).toBe(false);
    });

    it('returns true after grant()', () => {
      store.grant('my-app', 'user-1');
      expect(store.isGranted('my-app')).toBe(true);
    });

    it('returns false after revoke()', () => {
      store.grant('my-app', 'user-1');
      store.revoke('my-app', 'user-1');
      expect(store.isGranted('my-app')).toBe(false);
    });
  });

  describe('grant()', () => {
    it('returns a consent record with GRANTED status', () => {
      const record = store.grant('my-app', 'user-1');
      expect(record.appId).toBe('my-app');
      expect(record.userId).toBe('user-1');
      expect(record.status).toBe('GRANTED');
      expect(record.timestamp).toBeDefined();
      expect(typeof record.timestamp).toBe('string');
    });

    it('is idempotent — granting twice returns same status', () => {
      store.grant('my-app', 'user-1');
      const record = store.grant('my-app', 'user-2');
      expect(record.status).toBe('GRANTED');
      expect(record.userId).toBe('user-2'); // updates the user
    });
  });

  describe('revoke()', () => {
    it('returns a consent record with REVOKED status', () => {
      store.grant('my-app', 'user-1');
      const record = store.revoke('my-app', 'user-1');
      expect(record.appId).toBe('my-app');
      expect(record.userId).toBe('user-1');
      expect(record.status).toBe('REVOKED');
      expect(record.timestamp).toBeDefined();
    });

    it('works even if no consent was granted', () => {
      const record = store.revoke('my-app', 'user-1');
      expect(record.status).toBe('REVOKED');
    });

    it('purges telemetry data (right to erasure)', () => {
      store.grant('my-app', 'user-1');
      store.addTelemetry('my-app', { event: 'test' });
      expect(store.getTelemetry('my-app')).toHaveLength(1);

      store.revoke('my-app', 'user-1');
      expect(store.getTelemetry('my-app')).toHaveLength(0);
    });
  });

  describe('addTelemetry() / getTelemetry()', () => {
    it('does not store telemetry without consent', () => {
      store.addTelemetry('my-app', { event: 'test' });
      expect(store.getTelemetry('my-app')).toHaveLength(0);
    });

    it('stores telemetry only when consent is granted', () => {
      store.grant('my-app', 'user-1');
      store.addTelemetry('my-app', { event: 'login' });
      store.addTelemetry('my-app', { event: 'logout' });
      expect(store.getTelemetry('my-app')).toHaveLength(2);
    });

    it('returns empty array for unknown app', () => {
      expect(store.getTelemetry('unknown')).toEqual([]);
    });

    it('stores unique app telemetry separately', () => {
      store.grant('app-a', 'user-1');
      store.grant('app-b', 'user-1');
      store.addTelemetry('app-a', { event: 'a1' });
      store.addTelemetry('app-b', { event: 'b1' });
      expect(store.getTelemetry('app-a')).toHaveLength(1);
      expect(store.getTelemetry('app-b')).toHaveLength(1);
    });
  });
});

describe('CONSENT_STORE_VERSION', () => {
  it('is a semver string', () => {
    expect(CONSENT_STORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
