/**
 * Tests for helpers/crypto.ts — computeShasum and verifySignature.
 */

import { describe, it, expect } from 'vitest';
import { computeShasum, verifySignature } from '../helpers/crypto.js';

// ---------------------------------------------------------------------------
// computeShasum
// ---------------------------------------------------------------------------

describe('computeShasum()', () => {
  it('returns a 64-character hex string for any input', () => {
    const hash = computeShasum(Buffer.from('hello world'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns consistent results for the same input', () => {
    const input = Buffer.from('test-data');
    const h1 = computeShasum(input);
    const h2 = computeShasum(input);
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different inputs', () => {
    const h1 = computeShasum(Buffer.from('data-a'));
    const h2 = computeShasum(Buffer.from('data-b'));
    expect(h1).not.toBe(h2);
  });

  it('produces the correct SHA-256 for known input', () => {
    // SHA-256 of "abc" is ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    const hash = computeShasum(Buffer.from('abc'));
    expect(hash).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('handles empty buffer', () => {
    // SHA-256 of empty string
    const hash = computeShasum(Buffer.alloc(0));
    expect(hash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

// ---------------------------------------------------------------------------
// verifySignature
// ---------------------------------------------------------------------------

describe('verifySignature()', () => {
  it('returns false for tampered data', () => {
    const data = Buffer.from('important payload');
    const publicKey =
      '3d4017c3e843895a92b70aa74d1d7f2d1d8e6b9a7d5c3f2e1a8b9c0d1e2f3a4b';
    const signature =
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    const result = verifySignature(data, signature, publicKey);
    expect(result).toBe(false);
  });

  it('rejects empty signature', () => {
    const data = Buffer.from('test');
    const publicKey =
      '3d4017c3e843895a92b70aa74d1d7f2d1d8e6b9a7d5c3f2e1a8b9c0d1e2f3a4b';

    const result = verifySignature(data, '', publicKey);
    expect(result).toBe(false);
  });

  it('rejects invalid hex signature gracefully', () => {
    const data = Buffer.from('test');
    const publicKey =
      '3d4017c3e843895a92b70aa74d1d7f2d1d8e6b9a7d5c3f2e1a8b9c0d1e2f3a4b';

    const result = verifySignature(data, 'not-hex', publicKey);
    expect(result).toBe(false);
  });

  it('rejects invalid public key gracefully', () => {
    const data = Buffer.from('test');
    const signature = 'a'.repeat(128);

    const result = verifySignature(data, signature, 'not-valid-hex');
    expect(result).toBe(false);
  });

  it('rejects mismatched key length gracefully', () => {
    const data = Buffer.from('test');
    const signature = 'a'.repeat(128);

    const result = verifySignature(data, signature, 'a'.repeat(16));
    expect(result).toBe(false);
  });
});
