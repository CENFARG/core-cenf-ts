/**
 * PermissionManager port interface — role-based access control.
 *
 * Depend on this interface, inject adapters. Never import adapters
 * directly in business logic.
 *
 * @module managers/permission/ports
 */

import type { AsyncLifecycle } from '@cenf/core';
import type { PermissionSubject } from './types.js';

/**
 * Permission manager port for role-based access control (RBAC).
 *
 * Provides subject-to-role mapping and permission checking
 * with default-deny semantics. Supports wildcard resources
 * and actions for flexible rule definition.
 * Extends `AsyncLifecycle` for uniform orchestration.
 */
export interface PermissionManager extends AsyncLifecycle {
  /**
   * Check whether a subject is allowed to perform an action on a resource.
   *
   * Evaluates the subject's assigned roles and their associated
   * permissions. Returns `true` if any role grants the requested
   * (resource, action) pair.
   *
   * @param subject - The subject requesting access.
   * @param resource - The target resource type.
   * @param action - The action to perform.
   * @returns `true` if the subject is authorized.
   */
  checkPermission(
    subject: PermissionSubject,
    resource: string,
    action: string,
  ): Promise<boolean>;

  /**
   * Grant a role to a subject.
   *
   * Adds the role to the subject's role list. If the role is
   * already assigned, this is a no-op (idempotent).
   *
   * @param subject - The subject to receive the role.
   * @param role - The role name to grant.
   */
  grantRole(subject: PermissionSubject, role: string): Promise<void>;

  /**
   * Revoke a role from a subject.
   *
   * Removes the role from the subject's role list.
   * If the subject does not have the role, this is a no-op.
   *
   * @param subject - The subject to lose the role.
   * @param role - The role name to revoke.
   */
  revokeRole(subject: PermissionSubject, role: string): Promise<void>;
}

/** Runtime version constant — ensures module existence for TDD. */
export const PERMISSION_PORT_VERSION = '0.1.0';
