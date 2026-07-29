/**
 * @cenf/maintenance — error reporting, telemetry, and maintenance services (M24).
 *
 * ## Quick Start
 *
 * ```typescript
 * import { MaintenanceManager, ErrorSeverity } from '@cenf/maintenance';
 * import { InMemoryMaintenanceAdapter } from '@cenf/maintenance/adapters';
 *
 * const adapter = new InMemoryMaintenanceAdapter();
 * const result = await adapter.reportError({
 *   appId: 'my-app',
 *   message: 'Something went wrong',
 *   severity: ErrorSeverity.Error,
 *   timestamp: new Date().toISOString(),
 * });
 * ```
 *
 * ## Architecture
 *
 * The module follows a **factory + adapter** pattern:
 * - Use `createMaintenanceConfig()` to produce a typed config
 * - Instantiate the adapter for your transport (Memory, GitHub, Discord, CENF Server, GlitchTip)
 * - All adapters implement the same `MaintenanceManager` interface from `ports.js`
 * - Test with `InMemoryMaintenanceAdapter`, swap to real transports in production
 */

// Types
export { ErrorSeverity, createMaintenanceConfig, DEFAULT_MAINTENANCE_CONFIG } from './types.js';
export type { ErrorReport, ConsentResult, ReportResult, MaintenanceConfig } from './types.js';

// Port
export type { MaintenanceManager } from './ports.js';

// Helpers
export { scrubPii, scrubDict } from './helpers/pii-scrubber.js';
export { ConsentStore } from './helpers/consent-store.js';

// Adapters (re-exported for convenience)
export { InMemoryMaintenanceAdapter } from './adapters/memory.adapter.js';
export { GitHubIssueAdapter } from './adapters/github-issue.adapter.js';
export { DiscordAlertAdapter } from './adapters/discord-alert.adapter.js';
export { CENFServerAdapter } from './adapters/cenf-server.adapter.js';
export { GlitchTipAdapter } from './adapters/glitchtip.adapter.js';
