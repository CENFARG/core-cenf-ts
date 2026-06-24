/**
 * BootstrapOrchestrator-specific types.
 *
 * Types for bootstrap configuration and manager registration.
 *
 * @module managers/bootstrap/types
 */

// ---------------------------------------------------------------------------
// BootstrapOptions — per-manager registration configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options when registering a manager with the
 * BootstrapOrchestrator.
 */
export interface BootstrapOptions {
  /**
   * Start priority (lower = earlier start, higher = later start).
   *
   * The standard CENF priority ordering:
   * 1=Config, 2=Logger, 3=Secret, 4=Error, 5=Observability,
   * 6=Validation, 7=Auth, 8=Cache, 9=FeatureFlag, 10=RateLimiter,
   * 11=Database, 12=Storage, 13=HttpClient, 14=CircuitBreaker,
   * 15=EventBus, 16=I18n, 17=JsonSerializer, 18=Health
   *
   * Default: 100 (lowest priority).
   */
  priority?: number;

  /**
   * Human-readable name for the manager.
   *
   * Must be unique across all registered managers.
   * Default: the manager's constructor name.
   */
  name?: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const BOOTSTRAP_TYPES_VERSION = '0.1.0';
