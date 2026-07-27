/**
 * ValidationManager port interface — boundary validation.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/validation/ports
 */

import type { ZodSchema } from 'zod';
import type { AsyncLifecycle } from '@cenf/core';
import type { Result } from '@cenf/core';

/**
 * A single field-level validation error.
 *
 * Captures the path to the invalid field and a
 * human-readable error message.
 */
export interface ValidationError {
  /** Dot-notation path to the invalid field (e.g., "address.city"). */
  path: string;
  /** Human-readable error message. */
  message: string;
}

/**
 * Schema-based validation manager port.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 * Wraps Zod's `safeParse` / `safeParseAsync` and returns
 * `Result<T, ValidationError[]>` instead of throwing.
 */
export interface IValidationManager extends AsyncLifecycle {
  /**
   * Synchronously validate data against a Zod schema.
   *
   * @param schema - The Zod schema to validate against.
   * @param data - The unknown data to validate.
   * @returns `Result.ok=true` with typed value on success,
   *          or `Result.ok=false` with field-level errors.
   */
  validate<T>(
    schema: ZodSchema<T>,
    data: unknown,
  ): Result<T, ValidationError[]>;

  /**
   * Asynchronously validate data against a Zod schema (with async refinements).
   *
   * @param schema - The Zod schema (may contain async refinements).
   * @param data - The unknown data to validate.
   * @returns `Result.ok=true` with typed value on success,
   *          or `Result.ok=false` with field-level errors.
   */
  validateAsync<T>(
    schema: ZodSchema<T>,
    data: unknown,
  ): Promise<Result<T, ValidationError[]>>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const VALIDATION_PORT_VERSION = '0.1.0';
