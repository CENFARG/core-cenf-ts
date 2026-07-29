import { describe, it, expect } from 'vitest';
import {
  PERMISSION_PORT_VERSION,
  type PermissionManager,
} from '../ports.js';
import type { PermissionSubject, Role, Resource, Action, Permission } from '../types.js';
import type { AsyncLifecycle } from '@cenf/core';
import type { HealthStatus } from '@cenf/core';

// ---------------------------------------------------------------------------
// Test implementation of PermissionManager for contract verification
// ---------------------------------------------------------------------------

class TestPermissionManager implements PermissionManager {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<HealthStatus> {
    return { status: 'healthy', details: {} };
  }

  async checkPermission(
    _subject: PermissionSubject,
    _resource: string,
    _action: string,
  ): Promise<boolean> {
    return false;
  }

  async grantRole(_subject: PermissionSubject, _role: string): Promise<void> {}
  async revokeRole(_subject: PermissionSubject, _role: string): Promise<void> {}
}

// ---------------------------------------------------------------------------
// PermissionManager port contract
// ---------------------------------------------------------------------------

describe('PermissionManager port', () => {
  it('exports a runtime version constant', () => {
    expect(PERMISSION_PORT_VERSION).toBe('0.1.0');
  });

  it('extends AsyncLifecycle', () => {
    const mgr: PermissionManager = new TestPermissionManager();
    expect(mgr).toBeDefined();
  });

  it('has start/stop/health from AsyncLifecycle', async () => {
    const mgr = new TestPermissionManager();
    await mgr.start();
    const h = await mgr.health();
    expect(h.status).toBe('healthy');
    await mgr.stop();
  });

  it('checkPermission() returns false by default', async () => {
    const mgr = new TestPermissionManager();
    const subject: PermissionSubject = { id: 'user-1', type: 'user', roles: [] };
    expect(await mgr.checkPermission(subject, 'document', 'read')).toBe(false);
  });

  it('grantRole() does not throw', async () => {
    const mgr = new TestPermissionManager();
    const subject: PermissionSubject = { id: 'user-1', type: 'user', roles: [] };
    await expect(mgr.grantRole(subject, 'admin')).resolves.toBeUndefined();
  });

  it('revokeRole() does not throw', async () => {
    const mgr = new TestPermissionManager();
    const subject: PermissionSubject = { id: 'user-1', type: 'user', roles: ['admin'] };
    await expect(mgr.revokeRole(subject, 'admin')).resolves.toBeUndefined();
  });

  it('fulfills the AsyncLifecycle contract', async () => {
    const lifecycle: AsyncLifecycle = new TestPermissionManager();
    await lifecycle.start();
    const health = await lifecycle.health();
    expect(health.status).toBe('healthy');
    await lifecycle.stop();
  });
});

// ---------------------------------------------------------------------------
// Permission types
// ---------------------------------------------------------------------------

describe('Permission types', () => {
  it('PermissionSubject has required fields', () => {
    const subject: PermissionSubject = {
      id: 'user-42',
      type: 'user',
      roles: ['admin', 'editor'],
    };
    expect(subject.id).toBe('user-42');
    expect(subject.type).toBe('user');
    expect(subject.roles).toEqual(['admin', 'editor']);
  });

  it('PermissionSubject supports all types', () => {
    const user: PermissionSubject = { id: 'u1', type: 'user', roles: [] };
    const role: PermissionSubject = { id: 'r1', type: 'role', roles: [] };
    const svc: PermissionSubject = { id: 's1', type: 'service', roles: [] };
    expect(user.type).toBe('user');
    expect(role.type).toBe('role');
    expect(svc.type).toBe('service');
  });

  it('Role has name and permissions', () => {
    const role: Role = {
      name: 'admin',
      permissions: [
        { resource: 'document', action: 'read' },
        { resource: 'document', action: 'write' },
      ],
    };
    expect(role.name).toBe('admin');
    expect(role.permissions).toHaveLength(2);
  });

  it('Permission has resource and action', () => {
    const perm: Permission = { resource: 'user', action: 'delete' };
    expect(perm.resource).toBe('user');
    expect(perm.action).toBe('delete');
  });

  it('Resource has type and optional id', () => {
    const res1: Resource = { type: 'document' };
    const res2: Resource = { type: 'document', id: 'doc-123' };
    expect(res1.type).toBe('document');
    expect(res1.id).toBeUndefined();
    expect(res2.id).toBe('doc-123');
  });

  it('Action has name and optional description', () => {
    const act1: Action = { name: 'delete' };
    const act2: Action = { name: 'export', description: 'Export data to CSV' };
    expect(act1.name).toBe('delete');
    expect(act1.description).toBeUndefined();
    expect(act2.description).toBe('Export data to CSV');
  });
});
