export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'finance'
  | 'marketing'
  | 'content'
  | 'support'
  | 'teacher'
  | 'student'
  | 'receptionist';

export type PermissionAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export';

export interface RolePermissionProps {
  id: string;
  tenantId: string;
  role: AdminRole;
  resource: string;      // e.g. 'payments', 'students', 'mcp_tools'
  actions: PermissionAction[];
  isActive: boolean;
  grantedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class RolePermission {
  private readonly props: Readonly<RolePermissionProps>;

  constructor(props: RolePermissionProps) {
    if (!props.id.trim())        throw new Error('id is required');
    if (!props.tenantId.trim())  throw new Error('tenantId is required');
    if (!props.resource.trim())  throw new Error('resource is required');
    if (!props.grantedBy.trim()) throw new Error('grantedBy is required');
    if (props.actions.length === 0)
      throw new Error('at least one action is required');
    const unique = new Set(props.actions);
    if (unique.size !== props.actions.length)
      throw new Error('duplicate actions are not allowed');

    this.props = { ...props, actions: [...props.actions] };
  }

  private clone(patch: Partial<RolePermissionProps>): RolePermission {
    return new RolePermission({ ...this.props, ...patch });
  }

  get id():        string             { return this.props.id; }
  get tenantId():  string             { return this.props.tenantId; }
  get role():      AdminRole          { return this.props.role; }
  get resource():  string             { return this.props.resource; }
  get actions():   PermissionAction[] { return [...this.props.actions]; }
  get isActive():  boolean            { return this.props.isActive; }
  get grantedBy(): string             { return this.props.grantedBy; }
  get createdAt(): Date               { return this.props.createdAt; }
  get updatedAt(): Date               { return this.props.updatedAt; }

  can(action: PermissionAction): boolean {
    return this.props.isActive && this.props.actions.includes(action);
  }

  canAny(actions: PermissionAction[]): boolean {
    return actions.some(a => this.can(a));
  }

  grantAction(action: PermissionAction, now: Date): RolePermission {
    if (this.props.actions.includes(action))
      throw new Error(`action "${action}" is already granted`);
    return this.clone({ actions: [...this.props.actions, action], updatedAt: now });
  }

  revokeAction(action: PermissionAction, now: Date): RolePermission {
    if (!this.props.actions.includes(action))
      throw new Error(`action "${action}" is not granted`);
    if (this.props.actions.length === 1)
      throw new Error('cannot revoke the last action — deactivate the permission instead');
    return this.clone({
      actions: this.props.actions.filter(a => a !== action),
      updatedAt: now,
    });
  }

  deactivate(now: Date): RolePermission {
    if (!this.props.isActive) throw new Error('permission is already inactive');
    return this.clone({ isActive: false, updatedAt: now });
  }

  reactivate(now: Date): RolePermission {
    if (this.props.isActive) throw new Error('permission is already active');
    return this.clone({ isActive: true, updatedAt: now });
  }
}
