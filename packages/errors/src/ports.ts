/**
 * ErrorHandlingManager port interface — unified error processing.
 *
 * Provides classification, reporting, and function-wrapping
 * for consistent error handling across all managers.
 *
 * @module managers/error-handling/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { ErrorClassification, ErrorContext, ErrorReport } from './types.js';

/**
 * Unified error handling manager port.
 *
 * Extends `AsyncLifecycle` for uniform orchestration.
 * Implementations classify errors, produce API-safe reports, and wrap
 * functions with automatic error catching and enrichment.
 */
export interface IErrorHandlingManager extends AsyncLifecycle {
  /**
   * Process an error and produce a structured report.
   *
   * Classifies the error, sanitizes sensitive data, and returns
   * an `ErrorReport` safe for logging and API responses.
   *
   * @param error - The error to process.
   * @param context - Optional context about where/how the error occurred.
   * @returns A structured error report.
   */
  handle(error: unknown, context?: ErrorContext): ErrorReport;

  /**
   * Wrap a function with automatic error handling.
   *
   * The returned function has the same signature but automatically
   * catches, classifies, and enriches errors before re-throwing.
   * Use with retry-aware callers or as a decorator pattern.
   *
   * @param fn - The function to wrap.
   * @returns A wrapped version of the function.
   */
  wrap<T extends (...args: unknown[]) => unknown>(fn: T): T;

  /**
   * Classify an error into a standard taxonomy.
   *
   * Maps CenfError subclasses to their categories and determines
   * retryability. Unknown errors default to the server category.
   *
   * @param error - The error to classify.
   * @returns Classification with category, retryability, and user message.
   */
  classify(error: unknown): ErrorClassification;
}

/** Runtime version constant — ensures module existence for TDD. */
export const ERROR_HANDLING_PORT_VERSION = '0.1.0';
