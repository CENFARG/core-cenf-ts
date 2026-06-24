/**
 * Standard error handling adapter.
 *
 * Implements classify, handle, and wrap using the CenfError taxonomy.
 * Pure logic — no external dependencies.
 *
 * @module managers/error-handling/adapters/standard.adapter
 */

import { isCenfError } from '../../../shared/utils.js';
import type { HealthStatus } from '../../../shared/types.js';
import type {
  ErrorCategory,
  ErrorClassification,
  ErrorContext,
  ErrorReport,
} from '../types.js';
import type { IErrorHandlingManager } from '../ports.js';

// ---------------------------------------------------------------------------
// Classification taxonomy: maps error codes to categories and retryability
// ---------------------------------------------------------------------------

interface ClassificationRule {
  category: ErrorCategory;
  retryable: boolean;
  userMessage?: string;
}

const CLASSIFICATION_MAP: Record<string, ClassificationRule> = {
  // Client errors — invalid input, fix the request
  ERR_CONFIG: { category: 'client', retryable: false },
  ERR_CONFIG_VALIDATION: { category: 'client', retryable: false },
  ERR_CONFIG_NOT_FOUND: { category: 'client', retryable: false },
  ERR_VALIDATION: { category: 'client', retryable: false },
  ERR_AUTH: { category: 'client', retryable: false },
  ERR_TOKEN_EXPIRED: {
    category: 'client',
    retryable: false,
    userMessage: 'Token expired',
  },
  ERR_TOKEN_INVALID: {
    category: 'client',
    retryable: false,
    userMessage: 'Token invalid',
  },
  ERR_TOKEN_VERIFICATION: {
    category: 'client',
    retryable: false,
    userMessage: 'Token verification failed',
  },

  // Timeout errors — transient, retry may help
  ERR_HTTP_TIMEOUT: { category: 'timeout', retryable: true },

  // Network errors — transient, retry may help
  ERR_HTTP_CLIENT: { category: 'network', retryable: true },
  ERR_CIRCUIT_BREAKER_OPEN: { category: 'network', retryable: true },

  // Server errors — internal infrastructure
  ERR_DATABASE_CONNECTION: { category: 'server', retryable: false },
  ERR_DATABASE_QUERY: { category: 'server', retryable: false },
  ERR_DATABASE_TRANSACTION: { category: 'server', retryable: false },
  ERR_CACHE_CONNECTION: { category: 'server', retryable: false },
  ERR_CACHE_OPERATION: { category: 'server', retryable: false },
  ERR_SECRET: { category: 'server', retryable: false },
  ERR_SECRET_NOT_FOUND: { category: 'server', retryable: false },
  ERR_STORAGE_UPLOAD: { category: 'server', retryable: false },
  ERR_STORAGE_DOWNLOAD: { category: 'server', retryable: false },
  ERR_STORAGE_DELETE: { category: 'server', retryable: false },
  ERR_EVENT_BUS_CONNECTION: { category: 'server', retryable: false },
  ERR_EVENT_BUS_PUBLISH: { category: 'server', retryable: false },
  ERR_EVENT_BUS_SUBSCRIPTION: { category: 'server', retryable: false },
  ERR_OBSERVABILITY_CONFIG: { category: 'server', retryable: false },
  ERR_I18N: { category: 'server', retryable: false },
  ERR_BOOTSTRAP: { category: 'server', retryable: false },
  ERR_SHUTDOWN: { category: 'server', retryable: false },
  ERR_HEALTH_CHECK_TIMEOUT: { category: 'server', retryable: false },
  ERR_JSON_SERIALIZATION: { category: 'server', retryable: false },
  ERR_JSON_DESERIALIZATION: { category: 'server', retryable: false },
};

const DEFAULT_CLASSIFICATION: ClassificationRule = {
  category: 'server',
  retryable: false,
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Standard implementation of `IErrorHandlingManager`.
 *
 * Uses a taxonomy map to classify CenfError subclasses by code.
 * Unknown errors and non-CenfError values default to server category.
 */
export class StandardErrorHandlingAdapter
  implements IErrorHandlingManager
{
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
    return { status: 'healthy', details: { adapter: 'standard' } };
  }

  // -------------------------------------------------------------------
  // IErrorHandlingManager
  // -------------------------------------------------------------------

  classify(error: unknown): ErrorClassification {
    if (isCenfError(error)) {
      const rule = CLASSIFICATION_MAP[error.code] ?? DEFAULT_CLASSIFICATION;
      return {
        category: rule.category,
        retryable: rule.retryable,
        ...(rule.userMessage ? { userMessage: rule.userMessage } : {}),
      };
    }

    // Non-CenfError — treat as server failure
    return { ...DEFAULT_CLASSIFICATION };
  }

  handle(error: unknown, context?: ErrorContext): ErrorReport {
    const classification = this.classify(error);

    // Determine the report code
    let code: string;
    if (isCenfError(error)) {
      code = error.code;
    } else if (error instanceof Error) {
      code = 'ERR_INTERNAL';
    } else {
      code = 'ERR_INTERNAL';
    }

    // Determine the message — sanitize for server/internal errors
    let message: string;
    if (classification.category === 'server') {
      // Sanitize: hide implementation details
      message = 'Internal server error';
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = 'Internal server error';
    }

    const report: ErrorReport = { code, message };

    // Attach context details when available
    if (context) {
      const details: Record<string, unknown> = {};
      if (context.source) details['source'] = context.source;
      if (context.operation) details['operation'] = context.operation;
      if (Object.keys(details).length > 0) {
        report.details = details;
      }
    }

    return report;
  }

  wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const wrapped = function (
      this: unknown,
      ...args: Parameters<T>
    ): ReturnType<T> {
      try {
        const result = fn.apply(this, args);

        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((err: unknown) => {
            self.handle(err, {
              source: fn.name || 'anonymous',
              operation: 'wrap',
            });
            throw err;
          }) as unknown as ReturnType<T>;
        }

        return result as ReturnType<T>;
      } catch (err) {
        self.handle(err, {
          source: fn.name || 'anonymous',
          operation: 'wrap',
        });
        throw err;
      }
    };

    return wrapped as T;
  }
}
