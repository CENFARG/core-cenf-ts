/**
 * PII Scrubber — regex-based PII masking for error reports.
 *
 * Provides client-side PII scrubbing before transport. Masks emails,
 * JWT tokens, passwords/secrets, credit card numbers, API keys, and
 * IP addresses using regex patterns.
 *
 * Security:
 *   - PII is scrubbed at capture time, never after storage.
 *   - All patterns are compiled at module load for consistent behaviour.
 *   - Token truncation preserves first 10 chars for debugging context.
 *
 * @ai-directive: Always scrub PII before returning ErrorReport from
 *   captureError(). Never send raw emails, tokens, or passwords.
 *
 * @module managers/maintenance/helpers/pii-scrubber
 */

// ---------------------------------------------------------------------------
// Compiled regex patterns
// ---------------------------------------------------------------------------

/** Email addresses: user@example.com → ***@example.com */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** JWT tokens: base64.base64.signature */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

/** Passwords / secrets in key=value patterns */
const PASSWORD_PATTERN = /(password|passwd|secret|token|api_key|apikey|auth)\s*[:=]\s*["']?[A-Za-z0-9_!@#$%^&*()\-=+]{4,}["']?/gi;

/** Credit card numbers (16-digit, with optional spaces/dashes) */
const CC_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

/** API keys (hex or base64 strings of length 32+) */
const API_KEY_PATTERN = /\b[A-Za-z0-9_\-]{32,}\b/g;

/** IP addresses (IPv4) */
const IP_PATTERN = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrub PII from a text string.
 *
 * Applies all PII regex patterns in order. Handles overlapping matches
 * by processing each pattern independently.
 *
 * @param text - The input text to scrub (stack trace, message, etc.).
 * @returns The scrubbed text with PII masked.
 */
export function scrubPii(text: string): string {
  if (!text) return text;

  // Order matters: process each pattern independently
  let result = text.replace(PASSWORD_PATTERN, maskPassword);
  result = result.replace(EMAIL_PATTERN, maskEmail);
  result = result.replace(JWT_PATTERN, maskJwt);
  result = result.replace(CC_PATTERN, '[REDACTED-CC]');
  result = result.replace(API_KEY_PATTERN, maskApiKey);
  result = result.replace(IP_PATTERN, '[REDACTED-IP]');
  return result;
}

/**
 * Recursively scrub PII from all string values in an object.
 *
 * Modifies the object in place and returns the same reference.
 *
 * @param data - The object to scrub (modified in place).
 * @returns The scrubbed object (same reference).
 */
export function scrubDict(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === 'string') {
      data[key] = scrubPii(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      scrubDict(value as Record<string, unknown>);
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Masking helpers
// ---------------------------------------------------------------------------

function maskEmail(match: string): string {
  const atIndex = match.indexOf('@');
  if (atIndex === -1) return match;
  const domain = match.slice(atIndex);
  return `***${domain}`;
}

function maskJwt(match: string): string {
  return match.slice(0, 10) + '...';
}

function maskPassword(match: string): string {
  const eqIndex = match.indexOf('=');
  if (eqIndex !== -1) {
    return match.slice(0, eqIndex) + '=***';
  }
  const colonIndex = match.indexOf(':');
  if (colonIndex !== -1) {
    return match.slice(0, colonIndex) + ': ***';
  }
  return match;
}

function maskApiKey(match: string): string {
  return match.slice(0, 8) + '...';
}

/** Runtime version constant — ensures module existence for TDD. */
export const PII_SCRUBBER_VERSION = '0.1.0';
