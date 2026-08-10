export type ConsentType =
  | 'terms_of_service' | 'privacy_policy' | 'marketing_emails'
  | 'marketing_sms' | 'data_processing' | 'medical_disclaimer' | 'recording_consent';

export interface ConsentRecordProps {
  id:         string;
  customerId: string;
  consentType: ConsentType;
  granted:    boolean;
  version:    string;     // document version e.g. "2026-08-01"
  grantedAt:  Date;
  revokedAt:  Date | null;
  ipAddress:  string;
  userAgent:  string;
  tenantId:   string;
  createdAt:  Date;
}

export class ConsentRecord {
  private readonly props: Readonly<ConsentRecordProps>;

  constructor(props: ConsentRecordProps) {
    if (!props.id.trim())         throw new Error('id is required');
    if (!props.customerId.trim()) throw new Error('customerId is required');
    if (!props.version.trim())    throw new Error('version is required');
    if (!props.tenantId.trim())   throw new Error('tenantId is required');
    if (props.revokedAt && props.revokedAt <= props.grantedAt)
      throw new Error('revokedAt must be after grantedAt');

    this.props = { ...props };
  }

  private clone(patch: Partial<ConsentRecordProps>): ConsentRecord {
    return new ConsentRecord({ ...this.props, ...patch });
  }

  get id()          { return this.props.id; }
  get customerId()  { return this.props.customerId; }
  get consentType() { return this.props.consentType; }
  get granted()     { return this.props.granted; }
  get version()     { return this.props.version; }
  get grantedAt()   { return this.props.grantedAt; }
  get revokedAt()   { return this.props.revokedAt; }
  get ipAddress()   { return this.props.ipAddress; }
  get userAgent()   { return this.props.userAgent; }
  get tenantId()    { return this.props.tenantId; }
  get createdAt()   { return this.props.createdAt; }

  isGranted(): boolean {
    return this.props.granted && !this.props.revokedAt;
  }

  revoke(at: Date): ConsentRecord {
    if (!this.props.granted)   throw new Error('Consent was never granted');
    if (this.props.revokedAt)  throw new Error('Consent already revoked');
    return this.clone({ granted: false, revokedAt: at });
  }

  toJSON(): ConsentRecordProps {
    return { ...this.props };
  }
}
