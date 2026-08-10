// Wave 18: Teacher Management — Teacher Certification entity
// Table-driven: type codes → ref_certification_type DB table
// Tenant-driven: tenantId on every instance
// State machine: pending_upload → under_review → verified | rejected → under_review → expired

export type CertificationType =
  | 'ryt_200' | 'ryt_500' | 'e_ryt_200' | 'e_ryt_500'
  | 'cpr_first_aid' | 'cpr_aed' | 'child_protection'
  | 'insurance_liability' | 'prenatal_certification'
  | 'therapeutic_yoga' | 'aerial_yoga' | 'hot_yoga'
  | 'kids_yoga' | 'yoga_therapy';

export type CertificationStatus =
  | 'pending_upload' | 'under_review' | 'verified' | 'expired' | 'rejected';

export interface TeacherCertificationProps {
  id:                   string;
  teacherId:            string;
  tenantId:             string;
  type:                 CertificationType;
  issuingOrganization:  string;
  certificationNumber?: string;
  issuedAt:             Date;
  expiresAt?:           Date;         // undefined = does not expire
  status:               CertificationStatus;
  documentUrl?:         string;
  verifiedAt?:          Date;
  verifiedBy?:          string;
  rejectionReason?:     string;
  reminderSentAt?:      Date;
  createdAt:            Date;
  updatedAt:            Date;
}

export class TeacherCertification {
  private readonly props: Readonly<TeacherCertificationProps>;

  constructor(props: TeacherCertificationProps) {
    if (!props.id?.trim())                  throw new Error('id is required');
    if (!props.teacherId?.trim())           throw new Error('teacherId is required');
    if (!props.tenantId?.trim())            throw new Error('tenantId is required');
    if (!props.issuingOrganization?.trim()) throw new Error('issuingOrganization is required');
    if (props.expiresAt && props.expiresAt <= props.issuedAt)
      throw new Error('expiresAt must be after issuedAt');
    if (props.status === 'verified' && !props.verifiedAt)
      throw new Error('verified certification must have verifiedAt');
    if (props.status === 'verified' && !props.verifiedBy?.trim())
      throw new Error('verified certification must have verifiedBy');
    if (props.status === 'rejected' && !props.rejectionReason?.trim())
      throw new Error('rejected certification must have rejectionReason');

    this.props = { ...props };
  }

  get id()                   { return this.props.id; }
  get teacherId()            { return this.props.teacherId; }
  get tenantId()             { return this.props.tenantId; }
  get type()                 { return this.props.type; }
  get issuingOrganization()  { return this.props.issuingOrganization; }
  get certificationNumber()  { return this.props.certificationNumber; }
  get issuedAt()             { return this.props.issuedAt; }
  get expiresAt()            { return this.props.expiresAt; }
  get status()               { return this.props.status; }
  get documentUrl()          { return this.props.documentUrl; }
  get verifiedAt()           { return this.props.verifiedAt; }
  get verifiedBy()           { return this.props.verifiedBy; }
  get rejectionReason()      { return this.props.rejectionReason; }
  get reminderSentAt()       { return this.props.reminderSentAt; }
  get createdAt()            { return this.props.createdAt; }
  get updatedAt()            { return this.props.updatedAt; }

  isPendingUpload() { return this.props.status === 'pending_upload'; }
  isUnderReview()   { return this.props.status === 'under_review';   }
  isVerified()      { return this.props.status === 'verified';       }
  isExpired()       { return this.props.status === 'expired';        }
  isRejected()      { return this.props.status === 'rejected';       }

  hasExpired(now: Date): boolean {
    return this.props.expiresAt !== undefined && now >= this.props.expiresAt;
  }

  daysUntilExpiry(now: Date): number | undefined {
    if (!this.props.expiresAt) return undefined;
    const ms = this.props.expiresAt.getTime() - now.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  private clone(patch: Partial<TeacherCertificationProps>): TeacherCertification {
    return new TeacherCertification({ ...this.props, ...patch });
  }

  submitForReview(documentUrl: string, now: Date): TeacherCertification {
    if (!documentUrl?.trim()) throw new Error('documentUrl is required');
    if (this.props.status !== 'pending_upload')
      throw new Error('can only submit a pending_upload certification for review');
    return this.clone({ status: 'under_review', documentUrl, updatedAt: now });
  }

  verify(verifiedBy: string, now: Date): TeacherCertification {
    if (!verifiedBy?.trim()) throw new Error('verifiedBy is required');
    if (this.props.status !== 'under_review')
      throw new Error('can only verify an under_review certification');
    return this.clone({ status: 'verified', verifiedAt: now, verifiedBy, updatedAt: now });
  }

  reject(reason: string, now: Date): TeacherCertification {
    if (!reason?.trim()) throw new Error('rejection reason is required');
    if (this.props.status !== 'under_review')
      throw new Error('can only reject an under_review certification');
    return this.clone({ status: 'rejected', rejectionReason: reason, updatedAt: now });
  }

  resubmit(documentUrl: string, now: Date): TeacherCertification {
    if (!documentUrl?.trim()) throw new Error('documentUrl is required');
    if (this.props.status !== 'rejected')
      throw new Error('can only resubmit a rejected certification');
    return this.clone({
      status:          'under_review',
      documentUrl,
      rejectionReason: undefined,
      updatedAt:       now,
    });
  }

  expire(now: Date): TeacherCertification {
    if (this.props.status !== 'verified')
      throw new Error('can only expire a verified certification');
    return this.clone({ status: 'expired', updatedAt: now });
  }

  sendReminder(now: Date): TeacherCertification {
    if (this.props.status !== 'verified')
      throw new Error('can only send reminder for a verified certification');
    if (!this.props.expiresAt)
      throw new Error('certification does not have an expiry date');
    return this.clone({ reminderSentAt: now, updatedAt: now });
  }
}
