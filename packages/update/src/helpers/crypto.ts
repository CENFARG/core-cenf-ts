/**
 * Cryptographic helpers for @cenf/update.
 *
 * Provides SHA-256 hashing (computeShasum) and Ed25519 signature
 * verification (verifySignature) for artifact integrity checks.
 *
 * Security:
 *   - computeShasum uses Node.js built-in crypto (FIPS-compliant).
 *   - verifySignature uses Node.js crypto Ed25519 (Node >= 12).
 *   - All verification failures are silent (return false) to prevent
 *     timing-based or error-based oracle attacks.
 *
 * @module managers/update/helpers/crypto
 */

import { createHash, createPublicKey, verify } from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SPKI DER header for Ed25519 public keys (30 2a 30 05 06 03 2b 65 70 03 21 00). */
const ED25519_SPKI_HEADER = Buffer.from(
  '302a300506032b6570032100',
  'hex',
);

/** Ed25519 public key length in bytes. */
const ED25519_KEY_LENGTH = 32;

/** Ed25519 signature length in bytes. */
const ED25519_SIG_LENGTH = 64;

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a buffer.
 *
 * @param buffer - The data to hash.
 * @returns 64-character lowercase hex digest.
 */
export function computeShasum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Ed25519 verification
// ---------------------------------------------------------------------------

/**
 * Verify an Ed25519 signature against a public key.
 *
 * Takes a raw 32-byte Ed25519 public key (hex-encoded) and a raw
 * 64-byte Ed25519 signature (hex-encoded). Wraps the public key in
 * SPKI DER format before verification.
 *
 * Returns false for any verification failure (invalid key, invalid
 * signature format, or actual signature mismatch) — never throws.
 *
 * @param data - The original data that was signed.
 * @param signature - The hex-encoded Ed25519 signature.
 * @param publicKey - The hex-encoded Ed25519 public key.
 * @returns true if the signature is valid, false otherwise.
 */
export function verifySignature(
  data: Buffer,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const keyRaw = Buffer.from(publicKey, 'hex');

    // Validate key and signature lengths
    if (keyRaw.length !== ED25519_KEY_LENGTH) return false;
    if (sigBuf.length !== ED25519_SIG_LENGTH) return false;

    // Wrap raw key in SPKI DER structure for Node.js crypto
    const spkiDer = Buffer.concat([ED25519_SPKI_HEADER, keyRaw]);
    const publicKeyObj = createPublicKey({
      key: spkiDer,
      format: 'der',
      type: 'spki',
    });

    return verify(null, data, publicKeyObj, sigBuf);
  } catch {
    // Any failure (bad key format, bad signature format) → invalid
    return false;
  }
}
