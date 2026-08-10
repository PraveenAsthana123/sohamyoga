export type IdentityStatus  = 'unverified' | 'active' | 'locked' | 'suspended';
export type LoginMethod     =
  | 'password' | 'otp' | 'google' | 'facebook' | 'apple'
  | 'microsoft' | 'passkey' | 'qr_challenge';
export type PortalRole =
  | 'visitor' | 'customer' | 'parent_guardian' | 'teacher'
  | 'reception' | 'marketing' | 'finance' | 'portal_admin' | 'super_admin';

const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS   = 30 * 60 * 1000; // 30 min

export interface IdentityAccountProps {
  id:                string;
  keycloakId:        string;
  email:             string;
  roles:             PortalRole[];
  status:            IdentityStatus;
  mfaEnabled:        boolean;
  lastLoginAt:       Date | null;
  lastLoginMethod:   LoginMethod | null;
  loginFailureCount: number;
  lockedUntil:       Date | null;
  tenantId:          string;
  createdAt:         Date;
  updatedAt:         Date;
}

export class IdentityAccount {
  private readonly props: Readonly<IdentityAccountProps>;

  constructor(props: IdentityAccountProps) {
    if (!props.id.trim())         throw new Error('id is required');
    if (!props.keycloakId.trim()) throw new Error('keycloakId is required');
    if (!props.email.includes('@')) throw new Error('email is invalid');
    if (!props.tenantId.trim())   throw new Error('tenantId is required');
    if (props.loginFailureCount < 0) throw new Error('loginFailureCount must be ≥ 0');

    this.props = { ...props, roles: [...props.roles] };
  }

  private clone(patch: Partial<IdentityAccountProps>): IdentityAccount {
    return new IdentityAccount({
      ...this.props,
      ...patch,
      roles: patch.roles ? [...patch.roles] : [...this.props.roles],
      updatedAt: new Date(),
    });
  }

  get id()                { return this.props.id; }
  get keycloakId()        { return this.props.keycloakId; }
  get email()             { return this.props.email; }
  get roles()             { return [...this.props.roles]; }
  get status()            { return this.props.status; }
  get mfaEnabled()        { return this.props.mfaEnabled; }
  get lastLoginAt()       { return this.props.lastLoginAt; }
  get lastLoginMethod()   { return this.props.lastLoginMethod; }
  get loginFailureCount() { return this.props.loginFailureCount; }
  get lockedUntil()       { return this.props.lockedUntil; }
  get tenantId()          { return this.props.tenantId; }
  get createdAt()         { return this.props.createdAt; }
  get updatedAt()         { return this.props.updatedAt; }

  activate(): IdentityAccount {
    if (this.props.status === 'locked')    throw new Error('Cannot activate a locked account — unlock first');
    if (this.props.status === 'suspended') throw new Error('Cannot activate a suspended account');
    return this.clone({ status: 'active' });
  }

  lock(until?: Date): IdentityAccount {
    const lockedUntil = until ?? new Date(Date.now() + LOCK_DURATION_MS);
    return this.clone({ status: 'locked', lockedUntil });
  }

  unlock(): IdentityAccount {
    return this.clone({ status: 'active', lockedUntil: null, loginFailureCount: 0 });
  }

  suspend(): IdentityAccount {
    return this.clone({ status: 'suspended', lockedUntil: null });
  }

  recordLogin(method: LoginMethod, at: Date): IdentityAccount {
    if (this.props.status !== 'active') throw new Error('Only active accounts can record logins');
    return this.clone({ lastLoginAt: at, lastLoginMethod: method, loginFailureCount: 0 });
  }

  incrementLoginFailure(): IdentityAccount {
    const count = this.props.loginFailureCount + 1;
    if (count >= MAX_LOGIN_FAILURES) {
      return this.clone({ loginFailureCount: count }).lock();
    }
    return this.clone({ loginFailureCount: count });
  }

  enableMfa(): IdentityAccount {
    return this.clone({ mfaEnabled: true });
  }

  disableMfa(): IdentityAccount {
    return this.clone({ mfaEnabled: false });
  }

  assignRole(role: PortalRole): IdentityAccount {
    if (this.props.roles.includes(role)) throw new Error(`Role '${role}' already assigned`);
    return this.clone({ roles: [...this.props.roles, role] });
  }

  revokeRole(role: PortalRole): IdentityAccount {
    if (!this.props.roles.includes(role)) throw new Error(`Role '${role}' not assigned`);
    return this.clone({ roles: this.props.roles.filter((r) => r !== role) });
  }

  hasRole(role: PortalRole): boolean {
    return this.props.roles.includes(role);
  }

  isLockedOut(now: Date): boolean {
    if (this.props.status !== 'locked') return false;
    if (!this.props.lockedUntil) return true;
    return now < this.props.lockedUntil;
  }

  toJSON(): IdentityAccountProps {
    return { ...this.props, roles: [...this.props.roles] };
  }
}
