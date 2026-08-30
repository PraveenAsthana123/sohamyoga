export interface AdminUserProps {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminUser {
  private readonly props: AdminUserProps;

  constructor(props: AdminUserProps) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) throw new Error('email must be a valid address');
    if (!props.passwordHash) throw new Error('passwordHash is required');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get passwordHash() { return this.props.passwordHash; }
  get displayName() { return this.props.displayName; }
  get isActive() { return this.props.isActive; }

  deactivate(): AdminUser {
    return new AdminUser({ ...this.props, isActive: false, updatedAt: new Date() });
  }

  /** Returns a JSON-safe representation that never leaks the password hash. */
  toJSON(): Omit<AdminUserProps, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safe } = this.props;
    return safe;
  }
}
