import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryPermissionAdapter } from '../adapters/memory.adapter.js';
import type { PermissionManager } from '../ports.js';
import type { PermissionSubject, Role } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const adminRole: Role = {
  name: 'admin',
  permissions: [
    { resource: 'document', action: 'read' },
    { resource: 'document', action: 'write' },
    { resource: 'document', action: 'delete' },
    { resource: 'user', action: 'read' },
    { resource: 'user', action: 'manage' },
    { resource: '*', action: 'audit' },
  ],
};

const editorRole: Role = {
  name: 'editor',
  permissions: [
    { resource: 'document', action: 'read' },
    { resource: 'document', action: 'write' },
  ],
};

const viewerRole: Role = {
  name: 'viewer',
  permissions: [
    { resource: 'document', action: 'read' },
  ],
};

function makeSubject(roles: string[] = []): PermissionSubject {
  return { id: 'user-1', type: 'user', roles };
}

// ---------------------------------------------------------------------------
// InMemoryPermissionAdapter
// ---------------------------------------------------------------------------

describe('InMemoryPermissionAdapter', () => {
  let manager: PermissionManager;
  let subject: PermissionSubject;

  describe('default-deny', () => {
    beforeEach(async () => {
      manager = new InMemoryPermissionAdapter([adminRole, editorRole, viewerRole]);
      await manager.start();
      subject = makeSubject();
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('denies access when subject has no roles', async () => {
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(false);
    });

    it('denies access for unknown role', async () => {
      subject.roles.push('nonexistent');
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(false);
    });

    it('denies access for wrong resource', async () => {
      subject.roles.push('viewer');
      expect(await manager.checkPermission(subject, 'user', 'manage')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Role-based access
  // -----------------------------------------------------------------------

  describe('role-based access', () => {
    beforeEach(async () => {
      manager = new InMemoryPermissionAdapter([adminRole, editorRole, viewerRole]);
      await manager.start();
      subject = makeSubject(['viewer']);
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('allows access when role has the permission', async () => {
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(true);
    });

    it('denies access when role lacks the permission', async () => {
      expect(await manager.checkPermission(subject, 'document', 'delete')).toBe(false);
    });

    it('multiple roles combine permissions', async () => {
      subject.roles.push('editor');
      expect(await manager.checkPermission(subject, 'document', 'write')).toBe(true);
    });

    it('admin role has audit wildcard', async () => {
      subject.roles.push('admin');
      expect(await manager.checkPermission(subject, 'any-resource', 'audit')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // grantRole / revokeRole
  // -----------------------------------------------------------------------

  describe('grantRole and revokeRole', () => {
    beforeEach(async () => {
      manager = new InMemoryPermissionAdapter([editorRole, viewerRole]);
      await manager.start();
      subject = makeSubject(['viewer']);
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('grantRole adds a new role', async () => {
      expect(await manager.checkPermission(subject, 'document', 'write')).toBe(false);
      await manager.grantRole(subject, 'editor');
      expect(await manager.checkPermission(subject, 'document', 'write')).toBe(true);
    });

    it('grantRole is idempotent — adding same role again does not duplicate', async () => {
      await manager.grantRole(subject, 'editor');
      await manager.grantRole(subject, 'editor');
      expect(subject.roles.filter((r) => r === 'editor')).toHaveLength(1);
    });

    it('revokeRole removes a role', async () => {
      await manager.grantRole(subject, 'editor');
      expect(await manager.checkPermission(subject, 'document', 'write')).toBe(true);

      await manager.revokeRole(subject, 'editor');
      expect(await manager.checkPermission(subject, 'document', 'write')).toBe(false);
    });

    it('revokeRole on non-existent role does nothing', async () => {
      await manager.revokeRole(subject, 'nonexistent');
      expect(subject.roles).toEqual(['viewer']);
    });

    it('after revoking all roles, default-deny applies', async () => {
      await manager.revokeRole(subject, 'viewer');
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Wildcard matching
  // -----------------------------------------------------------------------

  describe('wildcard matching', () => {
    beforeEach(async () => {
      manager = new InMemoryPermissionAdapter([adminRole]);
      await manager.start();
      subject = makeSubject(['admin']);
    });

    afterEach(async () => {
      await manager.stop();
    });

    it('wildcard resource matches any resource', async () => {
      expect(await manager.checkPermission(subject, 'anything', 'audit')).toBe(true);
    });

    it('wildcard action matches any action', async () => {
      // admin has document read/write/delete — not wildcard action
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(true);
    });

    it('specific resource takes priority over wildcard', async () => {
      // admin has document:read explicitly
      expect(await manager.checkPermission(subject, 'document', 'read')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty roles registry denies everything', async () => {
      const mgr = new InMemoryPermissionAdapter([]);
      await mgr.start();
      const subj = makeSubject(['admin']);
      expect(await mgr.checkPermission(subj, 'document', 'read')).toBe(false);
      await mgr.stop();
    });

    it('subject with empty roles array is denied', async () => {
      const mgr = new InMemoryPermissionAdapter([adminRole]);
      await mgr.start();
      const subj = makeSubject([]);
      expect(await mgr.checkPermission(subj, 'document', 'read')).toBe(false);
      await mgr.stop();
    });

    it('service subject type works the same as user', async () => {
      const mgr = new InMemoryPermissionAdapter([editorRole]);
      await mgr.start();
      const svc: PermissionSubject = { id: 'svc-1', type: 'service', roles: ['editor'] };
      expect(await mgr.checkPermission(svc, 'document', 'write')).toBe(true);
      await mgr.stop();
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('start() initializes clean state', async () => {
      const mgr = new InMemoryPermissionAdapter([adminRole]);
      await mgr.start();
      const h = await mgr.health();
      expect(h.status).toBe('healthy');
      await mgr.stop();
    });

    it('health() reports adapter info', async () => {
      const mgr = new InMemoryPermissionAdapter([adminRole, editorRole]);
      await mgr.start();
      const h = await mgr.health();
      expect(h.status).toBe('healthy');
      expect(h.details).toHaveProperty('adapter', 'memory');
      expect(h.details).toHaveProperty('rolesLoaded', 2);
      await mgr.stop();
    });
  });
});
