import { describe, it, expect } from '@jest/globals';
import { RolePermission, type RolePermissionProps, type AdminRole, type PermissionAction } from '../../../domain/security/RolePermission';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<RolePermissionProps>): RolePermission {
  return new RolePermission({
    id:        'rp-1',
    tenantId:  'tenant-1',
    role:      'admin',
    resource:  'payments',
    actions:   ['read', 'approve'],
    isActive:  true,
    grantedBy: 'super_admin',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('RolePermission — constructor', () => {
  it('creates an active permission', () => {
    const rp = make();
    expect(rp.isActive).toBe(true);
    expect(rp.actions).toEqual(['read', 'approve']);
  });

  it('throws when id is empty',        () => expect(() => make({ id: '' })).toThrow('id is required'));
  it('throws when tenantId is empty',  () => expect(() => make({ tenantId: '' })).toThrow('tenantId is required'));
  it('throws when resource is empty',  () => expect(() => make({ resource: '' })).toThrow('resource is required'));
  it('throws when grantedBy is empty', () => expect(() => make({ grantedBy: '' })).toThrow('grantedBy is required'));

  it('throws when actions is empty', () => {
    expect(() => make({ actions: [] })).toThrow('at least one action');
  });

  it('throws when actions has duplicates', () => {
    expect(() => make({ actions: ['read', 'read'] })).toThrow('duplicate actions');
  });
});

// ── All roles ─────────────────────────────────────────────────────────────────

describe('all roles accepted', () => {
  const roles: AdminRole[] = [
    'super_admin', 'admin', 'manager', 'finance', 'marketing',
    'content', 'support', 'teacher', 'student', 'receptionist',
  ];
  it.each(roles)('accepts role: %s', role => {
    expect(() => make({ role })).not.toThrow();
  });
});

// ── All actions ───────────────────────────────────────────────────────────────

describe('all actions accepted', () => {
  const actions: PermissionAction[] = ['read', 'create', 'update', 'delete', 'approve', 'export'];
  it.each(actions)('accepts action: %s', action => {
    expect(() => make({ actions: [action] })).not.toThrow();
  });
});

// ── can() / canAny() ──────────────────────────────────────────────────────────

describe('can() / canAny()', () => {
  it('returns true for granted action', () => {
    expect(make().can('read')).toBe(true);
    expect(make().can('approve')).toBe(true);
  });

  it('returns false for non-granted action', () => {
    expect(make().can('delete')).toBe(false);
  });

  it('returns false when inactive', () => {
    expect(make({ isActive: false }).can('read')).toBe(false);
  });

  it('canAny returns true when at least one matches', () => {
    expect(make().canAny(['delete', 'read'])).toBe(true);
  });

  it('canAny returns false when none match', () => {
    expect(make().canAny(['delete', 'create'])).toBe(false);
  });

  it('canAny returns false when inactive', () => {
    expect(make({ isActive: false }).canAny(['read', 'approve'])).toBe(false);
  });
});

// ── grantAction() ─────────────────────────────────────────────────────────────

describe('grantAction()', () => {
  it('adds a new action', () => {
    const rp = make().grantAction('delete', LATER);
    expect(rp.can('delete')).toBe(true);
    expect(rp.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate action', () => {
    expect(() => make().grantAction('read', LATER)).toThrow('already granted');
  });

  it('grants all 6 actions one by one', () => {
    let rp = make({ actions: ['read'] });
    const rest: PermissionAction[] = ['create', 'update', 'delete', 'approve', 'export'];
    for (const a of rest) rp = rp.grantAction(a, LATER);
    expect(rp.actions).toHaveLength(6);
  });
});

// ── revokeAction() ────────────────────────────────────────────────────────────

describe('revokeAction()', () => {
  it('removes an action', () => {
    const rp = make().revokeAction('approve', LATER);
    expect(rp.can('approve')).toBe(false);
    expect(rp.actions).toContain('read');
    expect(rp.updatedAt).toEqual(LATER);
  });

  it('throws when action not granted', () => {
    expect(() => make().revokeAction('delete', LATER)).toThrow('not granted');
  });

  it('throws when revoking the last action', () => {
    const single = make({ actions: ['read'] });
    expect(() => single.revokeAction('read', LATER)).toThrow('last action');
  });
});

// ── deactivate() / reactivate() ───────────────────────────────────────────────

describe('deactivate() / reactivate()', () => {
  it('deactivates active permission', () => {
    const rp = make().deactivate(LATER);
    expect(rp.isActive).toBe(false);
    expect(rp.can('read')).toBe(false);
    expect(rp.updatedAt).toEqual(LATER);
  });

  it('throws when already inactive', () => {
    expect(() => make({ isActive: false }).deactivate(LATER)).toThrow('already inactive');
  });

  it('reactivates inactive permission', () => {
    const rp = make({ isActive: false }).reactivate(LATER);
    expect(rp.isActive).toBe(true);
    expect(rp.can('read')).toBe(true);
  });

  it('throws when already active', () => {
    expect(() => make().reactivate(LATER)).toThrow('already active');
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('actions getter returns copy', () => {
    const rp = make();
    rp.actions.push('delete' as PermissionAction);
    expect(rp.actions).toHaveLength(2);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('grantAction does not mutate original', () => {
    const original = make();
    original.grantAction('delete', LATER);
    expect(original.actions).toHaveLength(2);
  });

  it('deactivate does not mutate original', () => {
    const original = make();
    original.deactivate(LATER);
    expect(original.isActive).toBe(true);
  });
});
