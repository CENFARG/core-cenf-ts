/**
 * PermissionManager-specific types.
 *
 * Types for RBAC subjects, roles, resources, and actions.
 *
 * @module managers/permission/types
 */

// ---------------------------------------------------------------------------
// PermissionSubject — the entity requesting access
// ---------------------------------------------------------------------------

/**
 * A subject requesting permission to perform an action on a resource.
 *
 * Subjects can be users, system roles, or service accounts.
 * Roles are assigned by name and resolved through the role registry.
 */
export interface PermissionSubject {
  /** Unique identifier for the subject. */
  id: string;

  /** Type of subject: user, role, or service account. */
  type: 'user' | 'role' | 'service';

  /** Role names assigned to this subject. */
  roles: string[];
}

// ---------------------------------------------------------------------------
// Role — a named set of permissions
// ---------------------------------------------------------------------------

/**
 * A named role that groups a set of permissions.
 *
 * Roles are assigned to subjects and checked during authorization.
 * Permissions within a role are OR'd — any matching permission grants access.
 */
export interface Role {
  /** Unique name of the role. */
  name: string;

  /** Permissions granted by this role. */
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Resource — the target of an action
// ---------------------------------------------------------------------------

/**
 * A resource that can be accessed.
 *
 * Resources are identified by type and optionally a specific instance ID.
 */
export interface Resource {
  /** The resource type (e.g., "document", "user", "project"). */
  type: string;

  /** Optional specific instance identifier. */
  id?: string;
}

// ---------------------------------------------------------------------------
// Action — an operation on a resource
// ---------------------------------------------------------------------------

/**
 * An action that can be performed on a resource.
 *
 * Actions represent operations like read, write, delete, or custom
 * domain-specific operations.
 */
export interface Action {
  /** Name of the action (e.g., "read", "write", "delete"). */
  name: string;

  /** Optional human-readable description of the action. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Permission — a single (resource, action) grant
// ---------------------------------------------------------------------------

/**
 * A single permission entry granting access to a resource action.
 *
 * Supports wildcard matching — use `'*'` for resource or action
 * to match any value.
 */
export interface Permission {
  /** Target resource type. `'*'` matches any resource. */
  resource: string;

  /** Target action name. `'*'` matches any action. */
  action: string;
}

// ---------------------------------------------------------------------------
// Runtime export
// ---------------------------------------------------------------------------

/** Runtime version constant — ensures module existence for TDD. */
export const PERMISSION_TYPES_VERSION = '0.1.0';
