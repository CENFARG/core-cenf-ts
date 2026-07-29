/**
 * In-memory permission adapter — RBAC with default-deny.
 *
 * Implements the PermissionManager port with zero external dependencies.
 * Uses a role registry with permission lists and supports wildcard
 * matching for both resource and action fields.
 *
 * @module managers/permission/adapters/memory.adapter
 */

import type { PermissionManager } from '../ports.js';
import type { PermissionSubject, Role } from '../types.js';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// InMemoryPermissionAdapter
// ---------------------------------------------------------------------------

/**
 * In-memory RBAC permission adapter with default-deny semantics.
 *
 * Maintains a role registry where each role defines a set of
 * (resource, action) permissions. Subjects are assigned roles
 * by name. Authorization fails closed — if no role matches,
 * access is denied.
 *
 * Use this adapter:
 * - In unit tests where a real permission backend is not available
 * - For simple RBAC scenarios without external dependencies
 * - As a fallback when the production permission service is unavailable
 */
export class InMemoryPermissionAdapter implements PermissionManager {
  private roles = new Map<string, Role>();

  /**
   * Create an in-memory permission adapter.
   *
   * @param roleDefs - Optional list of roles to pre-register.
   */
  constructor(roleDefs?: Role[]) {
    if (roleDefs) {
      for (const role of roleDefs) {
        this.roles.set(role.name, role);
      }
    }
  }

  // -----------------------------------------------------------------------
  // PermissionManager
  // -----------------------------------------------------------------------

  async checkPermission(
    subject: PermissionSubject,
    resource: string,
    action: string,
  ): Promise<boolean> {
    // Default-deny: no roles means no access.
    if (subject.roles.length === 0) return false;

    for (const roleName of subject.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      for (const perm of role.permissions) {
        if (this.matches(perm.resource, resource) && this.matches(perm.action, action)) {
          return true;
        }
      }
    }

    return false;
  }

  async grantRole(subject: PermissionSubject, role: string): Promise<void> {
    if (!subject.roles.includes(role)) {
      subject.roles.push(role);
    }
  }

  async revokeRole(subject: PermissionSubject, role: string): Promise<void> {
    const idx = subject.roles.indexOf(role);
    if (idx !== -1) {
      subject.roles.splice(idx, 1);
    }
  }

  // -----------------------------------------------------------------------
  // AsyncLifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    // Roles are already loaded from the constructor.
    // No async initialization needed.
  }

  async stop(): Promise<void> {
    // No resources to release.
  }

  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      details: {
        adapter: 'memory',
        rolesLoaded: this.roles.size,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Check if a permission value matches the requested value.
   *
   * A match occurs when the permission value equals the requested
   * value, or when the permission value is `'*'` (wildcard).
   */
  private matches(permissionValue: string, requestedValue: string): boolean {
    return permissionValue === '*' || permissionValue === requestedValue;
  }
}
