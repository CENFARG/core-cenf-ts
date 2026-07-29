/**
 * @cenf/update — desktop auto-update with signature verification and rollback.
 *
 * Provides:
 * - UpdateManager port interface
 * - Types: AvailableRelease, UpdateArtifact, UpdateResult, UpdateConfig, Channel
 * - Crypto helpers: computeShasum, verifySignature
 * - Adapters: InMemory, HTTP, pip, Web, GitHub Release, Android
 *
 * @module @cenf/update
 */

// Port
export { type UpdateManager, UPDATE_PORT_VERSION } from './ports.js';

// Types
export { Channel, UPDATE_TYPES_VERSION } from './types.js';
export type {
  AvailableRelease,
  UpdateArtifact,
  UpdateResult,
  UpdateConfig,
} from './types.js';

// Helpers
export { computeShasum, verifySignature } from './helpers/crypto.js';

// Adapters
export { InMemoryUpdateAdapter } from './adapters/in-memory.adapter.js';
export { HttpUpdateAdapter } from './adapters/http.adapter.js';
export { PipUpdateAdapter } from './adapters/pip.adapter.js';
export { WebUpdateAdapter } from './adapters/web.adapter.js';
export { GitHubReleaseAdapter } from './adapters/github-release.adapter.js';
export { AndroidUpdateAdapter } from './adapters/android.adapter.js';
