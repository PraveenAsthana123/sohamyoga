export type SocialLeadSource =
  | 'facebook_lead_form' | 'instagram_lead_form' | 'linkedin_lead_form'
  | 'google_ads' | 'tiktok_lead' | 'organic_social' | 'portal_signup' | 'referral';

export type SocialLeadStatus =
  | 'new' | 'contacted' | 'verified' | 'converted' | 'disqualified' | 'duplicate';

export type YogaInterest =
  | 'weight_loss' | 'stress_relief' | 'flexibility' | 'strength'
  | 'meditation' | 'pregnancy' | 'rehabilitation' | 'general_fitness';

export interface SocialLeadProps {
  id:              string;
  source:          SocialLeadSource;
  externalLeadId:  string | null;   // Facebook/LinkedIn lead ID
  name:            string;
  email:           string;
  mobile:          string | null;
  interest:        YogaInterest | null;
  adCampaignId:    string | null;
  status:          SocialLeadStatus;
  duplicateOfId:   string | null;
  convertedToId:   string | null;   // customerId after conversion
  marketingConsent: boolean;
  verifiedAt:      Date | null;
  contactedAt:     Date | null;
  convertedAt:     Date | null;
  rawPayload:      Record<string, unknown>;
  tenantId:        string;
  createdAt:       Date;
  updatedAt:       Date;
}

export class SocialLead {
  private readonly props: Readonly<SocialLeadProps>;

  constructor(props: SocialLeadProps) {
    if (!props.id.trim())    throw new Error('id is required');
    if (!props.name.trim())  throw new Error('name is required');
    if (!props.email.includes('@')) throw new Error('email is invalid');
    if (!props.tenantId.trim()) throw new Error('tenantId is required');

    this.props = { ...props };
  }

  private clone(patch: Partial<SocialLeadProps>): SocialLead {
    return new SocialLead({ ...this.props, ...patch, updatedAt: new Date() });
  }

  get id()               { return this.props.id; }
  get source()           { return this.props.source; }
  get externalLeadId()   { return this.props.externalLeadId; }
  get name()             { return this.props.name; }
  get email()            { return this.props.email; }
  get mobile()           { return this.props.mobile; }
  get interest()         { return this.props.interest; }
  get adCampaignId()     { return this.props.adCampaignId; }
  get status()           { return this.props.status; }
  get duplicateOfId()    { return this.props.duplicateOfId; }
  get convertedToId()    { return this.props.convertedToId; }
  get marketingConsent() { return this.props.marketingConsent; }
  get verifiedAt()       { return this.props.verifiedAt; }
  get contactedAt()      { return this.props.contactedAt; }
  get convertedAt()      { return this.props.convertedAt; }
  get tenantId()         { return this.props.tenantId; }
  get createdAt()        { return this.props.createdAt; }
  get updatedAt()        { return this.props.updatedAt; }

  markContacted(at: Date): SocialLead {
    if (this.props.status === 'converted')     throw new Error('Lead already converted');
    if (this.props.status === 'disqualified')  throw new Error('Lead is disqualified');
    return this.clone({ status: 'contacted', contactedAt: at });
  }

  markVerified(at: Date): SocialLead {
    if (this.props.status === 'disqualified') throw new Error('Lead is disqualified');
    return this.clone({ status: 'verified', verifiedAt: at });
  }

  convert(customerId: string, at: Date): SocialLead {
    if (this.props.status !== 'verified') throw new Error('Only verified leads can be converted');
    if (!customerId.trim()) throw new Error('customerId is required');
    return this.clone({ status: 'converted', convertedToId: customerId, convertedAt: at });
  }

  markDuplicate(duplicateOfId: string): SocialLead {
    if (!duplicateOfId.trim()) throw new Error('duplicateOfId is required');
    return this.clone({ status: 'duplicate', duplicateOfId });
  }

  disqualify(): SocialLead {
    if (this.props.status === 'converted') throw new Error('Cannot disqualify a converted lead');
    return this.clone({ status: 'disqualified' });
  }

  isActive(): boolean {
    return !['converted', 'disqualified', 'duplicate'].includes(this.props.status);
  }

  toJSON(): SocialLeadProps {
    return { ...this.props };
  }
}
