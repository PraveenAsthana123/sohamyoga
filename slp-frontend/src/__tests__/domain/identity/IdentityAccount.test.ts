import { IdentityAccount, IdentityAccountProps } from '../../../domain/identity/IdentityAccount';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides: Partial<IdentityAccountProps> = {}): IdentityAccount {
  return new IdentityAccount({
    id:                'id-1',
    keycloakId:        'kc-abc123',
    email:             'student@sohamyoga.ca',
    roles:             ['customer'],
    status:            'unverified',
    mfaEnabled:        false,
    lastLoginAt:       null,
    lastLoginMethod:   null,
    loginFailureCount: 0,
    lockedUntil:       null,
    tenantId:          'tenant-1',
    createdAt:         NOW,
    updatedAt:         NOW,
    ...overrides,
  });
}

describe('IdentityAccount', () => {
  describe('constructor', () => {
    it('creates with default unverified status', () => {
      const a = make();
      expect(a.status).toBe('unverified');
      expect(a.mfaEnabled).toBe(false);
      expect(a.loginFailureCount).toBe(0);
    });

    it('throws on blank id', () => {
      expect(() => make({ id: '' })).toThrow('id is required');
    });

    it('throws on blank keycloakId', () => {
      expect(() => make({ keycloakId: '  ' })).toThrow('keycloakId is required');
    });

    it('throws on invalid email', () => {
      expect(() => make({ email: 'notanemail' })).toThrow('email is invalid');
    });

    it('throws on negative failure count', () => {
      expect(() => make({ loginFailureCount: -1 })).toThrow('loginFailureCount must be ≥ 0');
    });
  });

  describe('activate', () => {
    it('transitions unverified → active', () => {
      expect(make().activate().status).toBe('active');
    });

    it('throws when activating a locked account', () => {
      expect(() => make({ status: 'locked' }).activate()).toThrow('locked');
    });

    it('throws when activating a suspended account', () => {
      expect(() => make({ status: 'suspended' }).activate()).toThrow('suspended');
    });
  });

  describe('lock / unlock', () => {
    it('locks and sets lockedUntil', () => {
      const a = make({ status: 'active' }).lock(LATER);
      expect(a.status).toBe('locked');
      expect(a.lockedUntil).toEqual(LATER);
    });

    it('uses default lockout duration when no until provided', () => {
      const a = make({ status: 'active' }).lock();
      expect(a.lockedUntil).not.toBeNull();
    });

    it('unlock returns to active and clears lockedUntil and failure count', () => {
      const a = make({ status: 'locked', lockedUntil: LATER, loginFailureCount: 5 }).unlock();
      expect(a.status).toBe('active');
      expect(a.lockedUntil).toBeNull();
      expect(a.loginFailureCount).toBe(0);
    });
  });

  describe('suspend', () => {
    it('suspends an active account', () => {
      expect(make({ status: 'active' }).suspend().status).toBe('suspended');
    });
  });

  describe('recordLogin', () => {
    it('records method and clears failure count', () => {
      const a = make({ status: 'active', loginFailureCount: 2 }).recordLogin('google', NOW);
      expect(a.lastLoginMethod).toBe('google');
      expect(a.lastLoginAt).toEqual(NOW);
      expect(a.loginFailureCount).toBe(0);
    });

    it('throws on inactive account', () => {
      expect(() => make({ status: 'unverified' }).recordLogin('password', NOW)).toThrow();
    });
  });

  describe('incrementLoginFailure', () => {
    it('increments the failure count', () => {
      expect(make().incrementLoginFailure().loginFailureCount).toBe(1);
    });

    it('locks account after 5 failures', () => {
      let a = make({ status: 'active' });
      for (let i = 0; i < 5; i++) a = a.incrementLoginFailure();
      expect(a.status).toBe('locked');
    });
  });

  describe('roles', () => {
    it('assigns a role', () => {
      const a = make().assignRole('teacher');
      expect(a.hasRole('teacher')).toBe(true);
    });

    it('throws on duplicate role assignment', () => {
      expect(() => make({ roles: ['customer'] }).assignRole('customer')).toThrow('already assigned');
    });

    it('revokes a role', () => {
      const a = make({ roles: ['customer', 'teacher'] }).revokeRole('teacher');
      expect(a.hasRole('teacher')).toBe(false);
      expect(a.hasRole('customer')).toBe(true);
    });

    it('throws revoking a role not assigned', () => {
      expect(() => make().revokeRole('finance')).toThrow('not assigned');
    });
  });

  describe('isLockedOut', () => {
    it('returns true when locked with future lockedUntil', () => {
      const a = make({ status: 'locked', lockedUntil: LATER });
      expect(a.isLockedOut(NOW)).toBe(true);
    });

    it('returns false after lockout expires', () => {
      const a = make({ status: 'locked', lockedUntil: NOW });
      expect(a.isLockedOut(LATER)).toBe(false);
    });

    it('returns false for active account', () => {
      expect(make({ status: 'active' }).isLockedOut(NOW)).toBe(false);
    });
  });

  describe('MFA', () => {
    it('enables MFA', () => {
      expect(make().enableMfa().mfaEnabled).toBe(true);
    });

    it('disables MFA', () => {
      expect(make({ mfaEnabled: true }).disableMfa().mfaEnabled).toBe(false);
    });
  });

  describe('immutability', () => {
    it('returns new instance on activate', () => {
      const a = make();
      const b = a.activate();
      expect(a.status).toBe('unverified');
      expect(b.status).toBe('active');
    });

    it('roles array is a defensive copy', () => {
      const a = make({ roles: ['customer'] });
      const roles = a.roles;
      roles.push('teacher');
      expect(a.roles).toHaveLength(1);
    });
  });
});
