import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ZodValidationAdapter } from '../adapters/zod.adapter.js';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const userSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  email: z.string().email(),
});

const asyncEmailSchema = z.object({
  email: z.string().email().refine(
    async (email) => {
      // Simulate async uniqueness check
      await new Promise((r) => setTimeout(r, 1));
      return !email.startsWith('taken-');
    },
    { message: 'Email is already taken' },
  ),
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('ZodValidationAdapter — validate()', () => {
  const adapter = new ZodValidationAdapter();

  it('returns success for valid data', () => {
    const result = adapter.validate(userSchema, {
      name: 'John',
      age: 30,
      email: 'john@example.com',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        name: 'John',
        age: 30,
        email: 'john@example.com',
      });
    }
  });

  it('returns failure with field errors for invalid data', () => {
    const result = adapter.validate(userSchema, {
      name: 'John',
      age: 'not-a-number',
      email: 'bad-email',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(2);
      expect(result.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'age',
            message: expect.stringContaining('number'),
          }),
          expect.objectContaining({
            path: 'email',
            message: expect.stringContaining('email'),
          }),
        ]),
      );
    }
  });

  it('returns a single error for one invalid field', () => {
    const result = adapter.validate(userSchema, {
      name: 'John',
      age: 30,
      email: 'invalid',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(1);
      expect(result.error[0]).toHaveProperty('path', 'email');
    }
  });

  it('coerces and transforms values according to schema', () => {
    const coercingSchema = z.object({
      count: z.coerce.number(),
    });

    const result = adapter.validate(coercingSchema, { count: '42' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.count).toBe(42);
    }
  });

  it('handles nested object validation errors', () => {
    const nestedSchema = z.object({
      address: z.object({
        city: z.string().min(1),
        zip: z.string().length(5),
      }),
    });

    const result = adapter.validate(nestedSchema, {
      address: { city: '', zip: '12' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.error.map((e) => e.path);
      expect(paths).toContain('address.city');
      expect(paths).toContain('address.zip');
    }
  });

  it('returns empty error array edge case covered by Result type', () => {
    // Valid data should never produce errors
    const result = adapter.validate(
      z.object({ x: z.string() }),
      { x: 'hello' },
    );
    expect(result.ok).toBe(true);
    // Type narrowing: ok=true means no error array
  });
});

// ---------------------------------------------------------------------------
// validateAsync()
// ---------------------------------------------------------------------------

describe('ZodValidationAdapter — validateAsync()', () => {
  const adapter = new ZodValidationAdapter();

  it('returns success for valid data with async refinement', async () => {
    const result = await adapter.validateAsync(asyncEmailSchema, {
      email: 'free@example.com',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('free@example.com');
    }
  });

  it('returns failure when async refinement rejects', async () => {
    const result = await adapter.validateAsync(asyncEmailSchema, {
      email: 'taken-user@example.com',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]).toHaveProperty(
        'message',
        'Email is already taken',
      );
    }
  });

  it('returns failure for sync validation errors in async path', async () => {
    const result = await adapter.validateAsync(asyncEmailSchema, {
      email: 'not-an-email',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]).toHaveProperty('path', 'email');
    }
  });
});
