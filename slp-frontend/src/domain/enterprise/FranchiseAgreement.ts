const CURRENCY_RE = /^[A-Z]{3}$/;

export type AgreementStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface FranchiseAgreementProps {
  id: string;
  tenantId: string;             // franchisor
  franchiseeTenantId: string;
  branchId: string;
  status: AgreementStatus;
  royaltyPercent: number;       // 0–100
  setupFee: number;             // cents >= 0
  monthlyFee: number;           // cents >= 0
  currency: string;             // ISO 4217
  startDate: Date;
  endDate: Date;
  signedByFranchisor?: string;
  signedByFranchisee?: string;
  signedAt?: Date;
  terminatedAt?: Date;
  terminationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FranchiseAgreement {
  private readonly props: Readonly<FranchiseAgreementProps>;

  constructor(props: FranchiseAgreementProps) {
    if (!props.id.trim())               throw new Error('id is required');
    if (!props.tenantId.trim())         throw new Error('tenantId is required');
    if (!props.franchiseeTenantId.trim()) throw new Error('franchiseeTenantId is required');
    if (!props.branchId.trim())         throw new Error('branchId is required');
    if (props.royaltyPercent < 0 || props.royaltyPercent > 100)
      throw new Error('royaltyPercent must be between 0 and 100');
    if (!Number.isInteger(props.setupFee) || props.setupFee < 0)
      throw new Error('setupFee must be a non-negative integer (cents)');
    if (!Number.isInteger(props.monthlyFee) || props.monthlyFee < 0)
      throw new Error('monthlyFee must be a non-negative integer (cents)');
    if (!CURRENCY_RE.test(props.currency))
      throw new Error('currency must be a 3-letter ISO 4217 code');
    if (props.endDate <= props.startDate)
      throw new Error('endDate must be after startDate');
    if (props.status === 'active' && (!props.signedByFranchisor || !props.signedByFranchisee))
      throw new Error('active agreement requires both signatures');
    if (props.status === 'terminated' && !props.terminationReason)
      throw new Error('terminated agreement requires terminationReason');

    this.props = { ...props };
  }

  private clone(patch: Partial<FranchiseAgreementProps>): FranchiseAgreement {
    return new FranchiseAgreement({ ...this.props, ...patch });
  }

  get id():                   string           { return this.props.id; }
  get tenantId():             string           { return this.props.tenantId; }
  get franchiseeTenantId():   string           { return this.props.franchiseeTenantId; }
  get branchId():             string           { return this.props.branchId; }
  get status():               AgreementStatus  { return this.props.status; }
  get royaltyPercent():       number           { return this.props.royaltyPercent; }
  get setupFee():             number           { return this.props.setupFee; }
  get monthlyFee():           number           { return this.props.monthlyFee; }
  get currency():             string           { return this.props.currency; }
  get startDate():            Date             { return this.props.startDate; }
  get endDate():              Date             { return this.props.endDate; }
  get signedByFranchisor():   string|undefined { return this.props.signedByFranchisor; }
  get signedByFranchisee():   string|undefined { return this.props.signedByFranchisee; }
  get signedAt():             Date|undefined   { return this.props.signedAt; }
  get terminatedAt():         Date|undefined   { return this.props.terminatedAt; }
  get terminationReason():    string|undefined { return this.props.terminationReason; }
  get createdAt():            Date             { return this.props.createdAt; }
  get updatedAt():            Date             { return this.props.updatedAt; }

  isDraft():      boolean { return this.props.status === 'draft'; }
  isActive():     boolean { return this.props.status === 'active'; }
  isExpired():    boolean { return this.props.status === 'expired'; }
  isTerminated(): boolean { return this.props.status === 'terminated'; }

  sign(franchisor: string, franchisee: string, now: Date): FranchiseAgreement {
    if (this.props.status !== 'draft')
      throw new Error('can only sign a draft agreement');
    if (!franchisor.trim()) throw new Error('franchisor name is required');
    if (!franchisee.trim()) throw new Error('franchisee name is required');
    return this.clone({
      status: 'active',
      signedByFranchisor: franchisor,
      signedByFranchisee: franchisee,
      signedAt: now,
      updatedAt: now,
    });
  }

  expire(now: Date): FranchiseAgreement {
    if (this.props.status !== 'active')
      throw new Error('can only expire an active agreement');
    return this.clone({ status: 'expired', updatedAt: now });
  }

  terminate(reason: string, now: Date): FranchiseAgreement {
    if (this.props.status !== 'active')
      throw new Error('can only terminate an active agreement');
    if (!reason.trim()) throw new Error('terminationReason is required');
    return this.clone({ status: 'terminated', terminationReason: reason, terminatedAt: now, updatedAt: now });
  }

  updateRoyalty(percent: number, now: Date): FranchiseAgreement {
    if (this.props.status !== 'active')
      throw new Error('can only update royalty on an active agreement');
    if (percent < 0 || percent > 100)
      throw new Error('royaltyPercent must be between 0 and 100');
    return this.clone({ royaltyPercent: percent, updatedAt: now });
  }

  monthlyRoyaltyAmount(): number {
    return Math.round(this.props.monthlyFee * (this.props.royaltyPercent / 100));
  }

  isExpiredByDate(now: Date): boolean {
    return now >= this.props.endDate;
  }
}
