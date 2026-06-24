/**
 * AsyncLocalStorage context wrapper for request-scoped state.
 *
 * Provides correlation ID, tenant, and user propagation across
 * async operations without explicit parameter threading.
 *
 * Mirrors Python `contextvars` behavior via Node.js `AsyncLocalStorage`.
 *
 * @module shared/context
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ContextStore } from './types.js';

/** The singleton AsyncLocalStorage instance for context propagation. */
const contextStore = new AsyncLocalStorage<ContextStore>();

/**
 * Execute a function within a context scope.
 *
 * The context is available to `getContext()` during execution
 * and automatically cleaned up when the function completes.
 *
 * @param ctx - The context data to inject.
 * @param fn - The function to execute within the context.
 * @returns The return value of `fn`.
 */
export function runInContext<T>(
  ctx: ContextStore,
  fn: () => T,
): T {
  return contextStore.run(ctx, fn);
}

/**
 * Retrieve the current context store.
 *
 * Returns `undefined` when called outside of a `runInContext` scope.
 *
 * @returns The current context store, or undefined.
 */
export function getContext(): ContextStore | undefined {
  return contextStore.getStore();
}

/**
 * Update the current context store by merging partial data.
 *
 * Preserves existing context fields (like `correlationId`) while
 * allowing new or updated fields (like `tenantId`, `userId`).
 *
 * Throws if called outside of a `runInContext` scope.
 *
 * @param update - Partial context store with fields to set or override.
 */
export function setContext(update: Partial<ContextStore>): void {
  const current = contextStore.getStore();
  if (current === undefined) {
    throw new Error('No active context. Call runInContext() first.');
  }
  Object.assign(current, update);
}
