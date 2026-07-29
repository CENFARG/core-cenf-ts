/**
 * @cenf/maintenance types — ErrorReport, ConsentResult, ReportResult, MaintenanceConfig, ErrorSeverity.
 *
 * Defines the shared data types for M24 MaintenanceManager.
 * ErrorReport carries PII-scrubbed error data. ConsentResult tracks GDPR
 * opt-in/revoke. ReportResult captures transport outcomes.
 *
 * Security:
 *   - ErrorReport.stackTrace MUST be scrubbed before storage/transport.
 *   - ConsentResult.status is validated (GRANTED|REVOKED|PENDING).
 *   - MaintenanceConfig defaults to enabled=false (consent gate default-off).
 *
 * @module managers/maintenance/types
 */

// ---------------------------------------------------------------------------
// ErrorSeverity
// ---------------------------------------------------------------------------

/**
 * Error severity levels in order of increasing importance.
 *
 * Mirrors standard logging severity for consistent filtering.
 */
export enum ErrorSeverity {
  Trace = 'TRACE',
  Debug = 'DEBUG',
  Info = 'INFO',
  Warning = 'WARNING',
  Error = 'ERROR',
  Critical = 'CRITICAL',
}

// ---------------------------------------------------------------------------
// ErrorReport
// ---------------------------------------------------------------------------

/**
 * PII-scrubbed error report for transport.
 *
 * Produced by captureError() after PII masking. Contains app identity,
 * exception message, stack trace, and optional context for debugging.
 *
 * Security:
 *   - message and stackTrace MUST be scrubbed before storage/transport.
 */
export interface ErrorReport {
  /** Application identifier where the error occurred. */
  appId: string;

  /** Exception message (PII-scrubbed). */
  message: string;

  /** Stack trace text (PII-scrubbed). Optional. */
  stackTrace?: string;

  /** App version at time of error (SemVer). Optional. */
  version?: string;

  /** Operating system identifier (e.g., "linux", "windows", "macos"). Optional. */
  os?: string;

  /** CPU architecture (e.g., "x64", "arm64"). Optional. */
  arch?: string;

  /** Runtime version (e.g., "Node.js v20.6.0"). Optional. */
  runtimeVersion?: string;

  /** When the error was captured (ISO 8601 UTC). */
  timestamp: string;

  /** Arbitrary context key-value pairs (PII-scrubbed). Optional. */
  context?: Record<string, unknown>;

  /** Error severity level. */
  severity: ErrorSeverity;

  /** Optional key-value tags for filtering. */
  tags?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// ConsentResult
// ---------------------------------------------------------------------------

/**
 * Result of a consent operation (grant or revoke).
 */
export interface ConsentResult {
  /** Application identifier. */
  appId: string;

  /** User identifier who granted/revoked consent. */
  userId: string;

  /** Consent status: GRANTED, REVOKED, or PENDING. */
  status: 'GRANTED' | 'REVOKED' | 'PENDING';

  /** When the consent operation occurred (ISO 8601 UTC). */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// ReportResult
// ---------------------------------------------------------------------------

/**
 * Result of a reportError() transport attempt.
 */
export interface ReportResult {
  /** Whether the transport succeeded. */
  success: boolean;

  /** Target identifier (e.g., "in-memory", "discord", "github", "cenf-server", "glitchtip"). */
  target: string;

  /** Error description on failure, or undefined on success. */
  error?: string;
}

// ---------------------------------------------------------------------------
// MaintenanceConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for MaintenanceManager adapters.
 *
 * Controls error reporting, consent behaviour, GitHub integration,
 * Discord alerts, CENF server and GlitchTip endpoints, telemetry,
 * and tail-based sampling.
 *
 * Security:
 *   enabled defaults to false — telemetry is off by default.
 *   consentRequired must be true for GDPR compliance.
 */
export interface MaintenanceConfig {
  /** Master switch for error reporting (default: false). */
  enabled?: boolean;

  /** Whether consent is required before sending data (default: true). */
  consentRequired?: boolean;

  /** Default application identifier. */
  appId?: string;

  /** Default application version (default: "0.1.0"). */
  appVersion?: string;

  /** GitHub repository for auto-issues (e.g., "owner/repo"). */
  githubRepo?: string;

  /** GitHub App ID for JWT-based auth. */
  githubAppId?: string;

  /** Discord webhook URL for alerts. */
  discordWebhookUrl?: string;

  /** CENF server REST API endpoint. */
  cenfServerUrl?: string;

  /** GlitchTip DSN for self-hosted error tracking. */
  glitchtipDsn?: string;

  /** Whether OTLP telemetry is active (default: false). */
  telemetryEnabled?: boolean;

  /** Tail-based sampling rate (0.0 to 1.0, default: 1.0). */
  errorSampleRate?: number;
}

// ---------------------------------------------------------------------------
// Runtime exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Default config factory
// ---------------------------------------------------------------------------

/**
 * Default values for MaintenanceConfig.
 */
export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: false,
  consentRequired: true,
  appId: '',
  appVersion: '0.1.0',
  telemetryEnabled: false,
  errorSampleRate: 1.0,
};

/**
 * Create a MaintenanceConfig with defaults merged with partial overrides.
 *
 * @param overrides - Optional partial config to override defaults.
 * @returns A complete MaintenanceConfig with all fields populated.
 */
export function createMaintenanceConfig(
  overrides?: Partial<MaintenanceConfig>,
): MaintenanceConfig {
  return { ...DEFAULT_MAINTENANCE_CONFIG, ...overrides };
}

/** Runtime version constant — ensures module existence for TDD. */
export const MAINTENANCE_TYPES_VERSION = '0.1.0';
