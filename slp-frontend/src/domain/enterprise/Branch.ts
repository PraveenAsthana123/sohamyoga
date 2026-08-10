export type BranchType = 'franchise' | 'corporate_owned' | 'partner' | 'virtual';
export type BranchStatus = 'pending_setup' | 'active' | 'inactive' | 'suspended';

export interface BranchProps {
  id: string;
  tenantId: string;
  parentTenantId?: string;
  name: string;
  type: BranchType;
  status: BranchStatus;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  email?: string;
  timezone: string;
  maxCapacity: number;
  openedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Branch {
  private readonly props: Readonly<BranchProps>;

  constructor(props: BranchProps) {
    if (!props.id.trim())          throw new Error('id is required');
    if (!props.tenantId.trim())    throw new Error('tenantId is required');
    if (!props.name.trim())        throw new Error('name is required');
    if (!props.addressLine1.trim()) throw new Error('addressLine1 is required');
    if (!props.city.trim())        throw new Error('city is required');
    if (!props.state.trim())       throw new Error('state is required');
    if (!props.country.trim())     throw new Error('country is required');
    if (!props.postalCode.trim())  throw new Error('postalCode is required');
    if (!props.timezone.trim())    throw new Error('timezone is required');
    if (!Number.isInteger(props.maxCapacity) || props.maxCapacity < 1)
      throw new Error('maxCapacity must be a positive integer');

    this.props = { ...props };
  }

  private clone(patch: Partial<BranchProps>): Branch {
    return new Branch({ ...this.props, ...patch });
  }

  get id():               string           { return this.props.id; }
  get tenantId():         string           { return this.props.tenantId; }
  get parentTenantId():   string|undefined { return this.props.parentTenantId; }
  get name():             string           { return this.props.name; }
  get type():             BranchType       { return this.props.type; }
  get status():           BranchStatus     { return this.props.status; }
  get addressLine1():     string           { return this.props.addressLine1; }
  get addressLine2():     string|undefined { return this.props.addressLine2; }
  get city():             string           { return this.props.city; }
  get state():            string           { return this.props.state; }
  get country():          string           { return this.props.country; }
  get postalCode():       string           { return this.props.postalCode; }
  get phone():            string|undefined { return this.props.phone; }
  get email():            string|undefined { return this.props.email; }
  get timezone():         string           { return this.props.timezone; }
  get maxCapacity():      number           { return this.props.maxCapacity; }
  get openedAt():         Date|undefined   { return this.props.openedAt; }
  get closedAt():         Date|undefined   { return this.props.closedAt; }
  get createdAt():        Date             { return this.props.createdAt; }
  get updatedAt():        Date             { return this.props.updatedAt; }

  isPendingSetup(): boolean { return this.props.status === 'pending_setup'; }
  isActive():       boolean { return this.props.status === 'active'; }
  isInactive():     boolean { return this.props.status === 'inactive'; }
  isSuspended():    boolean { return this.props.status === 'suspended'; }

  activate(now: Date): Branch {
    if (this.props.status !== 'pending_setup' &&
        this.props.status !== 'inactive' &&
        this.props.status !== 'suspended')
      throw new Error('can only activate a pending_setup, inactive, or suspended branch');
    return this.clone({ status: 'active', openedAt: this.props.openedAt ?? now, updatedAt: now });
  }

  suspend(now: Date): Branch {
    if (this.props.status !== 'active')
      throw new Error('can only suspend an active branch');
    return this.clone({ status: 'suspended', updatedAt: now });
  }

  reactivate(now: Date): Branch {
    if (this.props.status !== 'suspended')
      throw new Error('can only reactivate a suspended branch');
    return this.clone({ status: 'active', updatedAt: now });
  }

  deactivate(now: Date): Branch {
    if (this.props.status !== 'active')
      throw new Error('can only deactivate an active branch');
    return this.clone({ status: 'inactive', closedAt: now, updatedAt: now });
  }

  rename(name: string, now: Date): Branch {
    if (!name.trim()) throw new Error('name is required');
    return this.clone({ name, updatedAt: now });
  }

  setMaxCapacity(capacity: number, now: Date): Branch {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error('maxCapacity must be a positive integer');
    return this.clone({ maxCapacity: capacity, updatedAt: now });
  }
}
