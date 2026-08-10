const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export type ProgramStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface CorporateWellnessProgramProps {
  id: string;
  tenantId: string;
  corporateName: string;
  contactName: string;
  contactEmail: string;
  programName: string;
  employeeCount: number;    // currently enrolled
  maxEmployees: number;
  pricePerEmployee: number; // cents/month
  currency: string;
  startDate: Date;
  endDate: Date;
  status: ProgramStatus;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class CorporateWellnessProgram {
  private readonly props: Readonly<CorporateWellnessProgramProps>;

  constructor(props: CorporateWellnessProgramProps) {
    if (!props.id.trim())            throw new Error('id is required');
    if (!props.tenantId.trim())      throw new Error('tenantId is required');
    if (!props.corporateName.trim()) throw new Error('corporateName is required');
    if (!props.contactName.trim())   throw new Error('contactName is required');
    if (!EMAIL_RE.test(props.contactEmail)) throw new Error('contactEmail is invalid');
    if (!props.programName.trim())   throw new Error('programName is required');
    if (!Number.isInteger(props.maxEmployees) || props.maxEmployees < 1)
      throw new Error('maxEmployees must be a positive integer');
    if (!Number.isInteger(props.employeeCount) || props.employeeCount < 0)
      throw new Error('employeeCount must be a non-negative integer');
    if (props.employeeCount > props.maxEmployees)
      throw new Error('employeeCount cannot exceed maxEmployees');
    if (!Number.isInteger(props.pricePerEmployee) || props.pricePerEmployee < 0)
      throw new Error('pricePerEmployee must be a non-negative integer (cents)');
    if (!CURRENCY_RE.test(props.currency))
      throw new Error('currency must be a 3-letter ISO 4217 code');
    if (props.endDate <= props.startDate)
      throw new Error('endDate must be after startDate');

    this.props = { ...props, features: [...props.features] };
  }

  private clone(patch: Partial<CorporateWellnessProgramProps>): CorporateWellnessProgram {
    return new CorporateWellnessProgram({ ...this.props, ...patch });
  }

  get id():               string          { return this.props.id; }
  get tenantId():         string          { return this.props.tenantId; }
  get corporateName():    string          { return this.props.corporateName; }
  get contactName():      string          { return this.props.contactName; }
  get contactEmail():     string          { return this.props.contactEmail; }
  get programName():      string          { return this.props.programName; }
  get employeeCount():    number          { return this.props.employeeCount; }
  get maxEmployees():     number          { return this.props.maxEmployees; }
  get pricePerEmployee(): number          { return this.props.pricePerEmployee; }
  get currency():         string          { return this.props.currency; }
  get startDate():        Date            { return this.props.startDate; }
  get endDate():          Date            { return this.props.endDate; }
  get status():           ProgramStatus   { return this.props.status; }
  get features():         string[]        { return [...this.props.features]; }
  get createdAt():        Date            { return this.props.createdAt; }
  get updatedAt():        Date            { return this.props.updatedAt; }

  isDraft():     boolean { return this.props.status === 'draft'; }
  isActive():    boolean { return this.props.status === 'active'; }
  isPaused():    boolean { return this.props.status === 'paused'; }
  isCompleted(): boolean { return this.props.status === 'completed'; }
  isCancelled(): boolean { return this.props.status === 'cancelled'; }
  isAtCapacity(): boolean { return this.props.employeeCount >= this.props.maxEmployees; }

  activate(now: Date): CorporateWellnessProgram {
    if (this.props.status !== 'draft')
      throw new Error('can only activate a draft program');
    return this.clone({ status: 'active', updatedAt: now });
  }

  pause(now: Date): CorporateWellnessProgram {
    if (this.props.status !== 'active')
      throw new Error('can only pause an active program');
    return this.clone({ status: 'paused', updatedAt: now });
  }

  resume(now: Date): CorporateWellnessProgram {
    if (this.props.status !== 'paused')
      throw new Error('can only resume a paused program');
    return this.clone({ status: 'active', updatedAt: now });
  }

  complete(now: Date): CorporateWellnessProgram {
    if (this.props.status !== 'active')
      throw new Error('can only complete an active program');
    return this.clone({ status: 'completed', updatedAt: now });
  }

  cancel(now: Date): CorporateWellnessProgram {
    if (this.props.status === 'completed' || this.props.status === 'cancelled')
      throw new Error('cannot cancel a completed or already cancelled program');
    return this.clone({ status: 'cancelled', updatedAt: now });
  }

  enrollEmployee(now: Date): CorporateWellnessProgram {
    if (this.props.status !== 'active')
      throw new Error('can only enroll employees in an active program');
    if (this.props.employeeCount >= this.props.maxEmployees)
      throw new Error('program is at full capacity');
    return this.clone({ employeeCount: this.props.employeeCount + 1, updatedAt: now });
  }

  unenrollEmployee(now: Date): CorporateWellnessProgram {
    if (this.props.employeeCount === 0)
      throw new Error('no employees to unenroll');
    return this.clone({ employeeCount: this.props.employeeCount - 1, updatedAt: now });
  }

  addFeature(feature: string, now: Date): CorporateWellnessProgram {
    if (!feature.trim()) throw new Error('feature is required');
    if (this.props.features.includes(feature)) throw new Error('feature already added');
    return this.clone({ features: [...this.props.features, feature], updatedAt: now });
  }

  removeFeature(feature: string, now: Date): CorporateWellnessProgram {
    if (!this.props.features.includes(feature)) throw new Error('feature not found');
    return this.clone({ features: this.props.features.filter(f => f !== feature), updatedAt: now });
  }

  totalMonthlyRevenue(): number {
    return this.props.pricePerEmployee * this.props.employeeCount;
  }

  utilizationPercent(): number {
    if (this.props.maxEmployees === 0) return 0;
    return Math.round((this.props.employeeCount / this.props.maxEmployees) * 100);
  }
}
