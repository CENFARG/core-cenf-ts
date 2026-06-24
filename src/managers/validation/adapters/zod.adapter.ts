/**
 * Zod-based validation adapter.
 *
 * Wraps Zod's `safeParse` / `safeParseAsync` to return
 * `Result<T, ValidationError[]>` instead of throwing.
 *
 * @module managers/validation/adapters/zod.adapter
 */

import type { ZodSchema } from 'zod';
import type { Result } from '../../../shared/types.js';
import type { HealthStatus } from '../../../shared/types.js';
import type { IValidationManager, ValidationError } from '../ports.js';

/**
 * Validation adapter that wraps Zod schema validation.
 *
 * Converts Zod's `ZodIssue[]` into structured `ValidationError[]`
 * with dot-notation field paths and human-readable messages.
 */
export class ZodValidationAdapter implements IValidationManager {
  // -------------------------------------------------------------------
  // AsyncLifecycle
  // -------------------------------------------------------------------

  async start(): Promise<void> {
    // No-op: pure logic adapter requires no initialization
  }

  async stop(): Promise<void> {
    // No-op: pure logic adapter requires no cleanup
  }

  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: { adapter: 'zod' } };
  }

  // -------------------------------------------------------------------
  // IValidationManager
  // -------------------------------------------------------------------

  validate<T>(
    schema: ZodSchema<T>,
    data: unknown,
  ): Result<T, ValidationError[]> {
    const parsed = schema.safeParse(data);

    if (parsed.success) {
      return { ok: true, value: parsed.data };
    }

    return {
      ok: false,
      error: this.formatErrors(parsed.error.issues),
    };
  }

  async validateAsync<T>(
    schema: ZodSchema<T>,
    data: unknown,
  ): Promise<Result<T, ValidationError[]>> {
    const parsed = await schema.safeParseAsync(data);

    if (parsed.success) {
      return { ok: true, value: parsed.data };
    }

    return {
      ok: false,
      error: this.formatErrors(parsed.error.issues),
    };
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  /**
   * Convert Zod's `ZodIssue[]` into structured `ValidationError[]`.
   *
   * Flattens nested paths using dot notation (e.g., "address.city")
   * and extracts the first error message for each issue.
   */
  private formatErrors(
    issues: Array<{
      path: (string | number)[];
      message: string;
    }>,
  ): ValidationError[] {
    return issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    }));
  }
}
