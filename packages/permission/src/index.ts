/**
 * @cenf/permission — role-based access control.
 *
 * @module @cenf/permission
 */

// Port
export { type PermissionManager, PERMISSION_PORT_VERSION } from './ports.js';

// Types
export type {
  PermissionSubject,
  Role,
  Resource,
  Action,
  Permission,
} from './types.js';
export { PERMISSION_TYPES_VERSION } from './types.js';

// Adapters
export { InMemoryPermissionAdapter } from './adapters/memory.adapter.js';
