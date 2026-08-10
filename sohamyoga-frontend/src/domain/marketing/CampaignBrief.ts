// CampaignBrief — Digital Marketing Command Centre campaign record.
// Covers the full campaign lifecycle from brief → approval → active → completed.
// One campaign groups content variants across social, email, SMS, banners, blog.
// All data stays local; only approved rendered content is sent to external APIs.

export type CampaignObjective =
  | 'awareness' | 'lead' | 'registration' | 'booking' | 'sale' | 'retention';

export type CampaignOfferType =
  | 'trial' | 'membership' | 'workshop' | 'retreat' | 'referral' | 'promotional' | 'educational';

export type CampaignBriefStatus =
  | 'draft' | 'approved' | 'active' | 'paused' | 'completed' | 'archived';

export type ContentSequenceStep =
  | 'teaser' | 'launch' | 'reminder' | 'last_chance' | 'followup' | 'thank_you';

export interface CampaignBriefProps {
  id:                 string;
  tenantId:           string;
  name:               string;
  description:        string;
  objective:          CampaignObjective;
  offerType:          CampaignOfferType;
  targetPersona:      string[];       // ['beginner', 'adult', 'corporate', 'senior', ...]
  channels:           string[];       // ['instagram', 'email', 'sms', 'banner', 'blog', ...]
  contentSequence:    ContentSequenceStep[];
  budgetPlannedCAD:   number;
  budgetActualCAD:    number;
  startDate:          Date;
  endDate:            Date;
  status:             CampaignBriefStatus;
  approvedBy?:        string;
  approvedAt?:        Date;
  pausedReason?:      string;
  utmCampaign:        string;         // snake_case slug for UTM tagging
  createdBy:          string;
  createdAt:          Date;
  updatedAt:          Date;
}

export class CampaignBrief {
  private readonly props: Readonly<CampaignBriefProps>;

  constructor(props: CampaignBriefProps) {
    if (!props.id)                    throw new Error('id is required');
    if (!props.tenantId)              throw new Error('tenantId is required');
    if (!props.name.trim())           throw new Error('name is required');
    if (props.channels.length === 0)  throw new Error('at least one channel is required');
    if (props.endDate <= props.startDate)
      throw new Error('endDate must be after startDate');
    if (props.budgetPlannedCAD < 0)   throw new Error('budgetPlannedCAD must be >= 0');
    if (props.budgetActualCAD < 0)    throw new Error('budgetActualCAD must be >= 0');
    if (!props.utmCampaign.match(/^[a-z][a-z0-9_-]+$/))
      throw new Error('utmCampaign must be slug format (lowercase, hyphens/underscores)');
    if (props.status === 'approved' && !props.approvedBy)
      throw new Error('approvedBy required when status is approved');
    if (props.status === 'active' && !props.approvedBy)
      throw new Error('approvedBy required when status is active');
    this.props = Object.freeze({
      ...props,
      targetPersona:   [...props.targetPersona],
      channels:        [...props.channels],
      contentSequence: [...props.contentSequence],
    });
  }

  private clone(patch: Partial<CampaignBriefProps>): CampaignBrief {
    return new CampaignBrief({ ...this.props, ...patch });
  }

  get id()               { return this.props.id; }
  get tenantId()         { return this.props.tenantId; }
  get name()             { return this.props.name; }
  get objective()        { return this.props.objective; }
  get offerType()        { return this.props.offerType; }
  get targetPersona()    { return [...this.props.targetPersona]; }
  get channels()         { return [...this.props.channels]; }
  get contentSequence()  { return [...this.props.contentSequence]; }
  get budgetPlannedCAD() { return this.props.budgetPlannedCAD; }
  get budgetActualCAD()  { return this.props.budgetActualCAD; }
  get startDate()        { return this.props.startDate; }
  get endDate()          { return this.props.endDate; }
  get status()           { return this.props.status; }
  get approvedBy()       { return this.props.approvedBy; }
  get approvedAt()       { return this.props.approvedAt; }
  get utmCampaign()      { return this.props.utmCampaign; }
  get createdBy()        { return this.props.createdBy; }
  get updatedAt()        { return this.props.updatedAt; }

  isDraft():     boolean { return this.props.status === 'draft'; }
  isActive():    boolean { return this.props.status === 'active'; }
  isPaused():    boolean { return this.props.status === 'paused'; }
  isCompleted(): boolean { return this.props.status === 'completed'; }
  isArchived():  boolean { return this.props.status === 'archived'; }

  budgetUtilizationPct(): number {
    if (this.props.budgetPlannedCAD === 0) return 0;
    return Math.min(100, Math.round((this.props.budgetActualCAD / this.props.budgetPlannedCAD) * 100));
  }

  daysRemaining(now: Date): number {
    return Math.max(0, Math.ceil((this.props.endDate.getTime() - now.getTime()) / 86400000));
  }

  /** Marketing manager approves brief — draft → approved */
  approve(approvedBy: string, at: Date): CampaignBrief {
    if (this.props.status !== 'draft')
      throw new Error(`Can only approve draft campaigns, current status: ${this.props.status}`);
    return this.clone({ status: 'approved', approvedBy, approvedAt: at, updatedAt: at });
  }

  /** Go live — approved → active */
  launch(at: Date): CampaignBrief {
    if (this.props.status !== 'approved')
      throw new Error(`Can only launch approved campaigns, current status: ${this.props.status}`);
    return this.clone({ status: 'active', updatedAt: at });
  }

  /** Temporarily pause — active → paused */
  pause(reason: string, at: Date): CampaignBrief {
    if (this.props.status !== 'active')
      throw new Error(`Can only pause active campaigns, current status: ${this.props.status}`);
    return this.clone({ status: 'paused', pausedReason: reason, updatedAt: at });
  }

  /** Resume after pause — paused → active */
  resume(at: Date): CampaignBrief {
    if (this.props.status !== 'paused')
      throw new Error(`Can only resume paused campaigns, current status: ${this.props.status}`);
    return this.clone({ status: 'active', pausedReason: undefined, updatedAt: at });
  }

  /** Wrap up — active | paused → completed */
  complete(at: Date): CampaignBrief {
    if (!['active', 'paused'].includes(this.props.status))
      throw new Error(`Can only complete active or paused campaigns, current status: ${this.props.status}`);
    return this.clone({ status: 'completed', updatedAt: at });
  }

  /** Soft-delete — any non-archived → archived */
  archive(at: Date): CampaignBrief {
    if (this.props.status === 'archived')
      throw new Error('Campaign is already archived');
    return this.clone({ status: 'archived', updatedAt: at });
  }

  /** Record actual spend */
  recordSpend(amountCAD: number, at: Date): CampaignBrief {
    if (amountCAD < 0) throw new Error('spend amount must be >= 0');
    return this.clone({ budgetActualCAD: this.props.budgetActualCAD + amountCAD, updatedAt: at });
  }
}
