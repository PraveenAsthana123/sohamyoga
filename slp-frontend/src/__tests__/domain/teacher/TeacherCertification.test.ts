import { describe, it, expect } from '@jest/globals';
import { TeacherCertification, type TeacherCertificationProps, type CertificationType } from '../../../domain/teacher/TeacherCertification';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');
const PAST   = new Date('2025-01-01T00:00:00Z');

function make(overrides?: Partial<TeacherCertificationProps>): TeacherCertification {
  return new TeacherCertification({
    id:                  'cert-1',
    teacherId:           'teacher-1',
    tenantId:            'tenant-1',
    type:                'ryt_200',
    issuingOrganization: 'Yoga Alliance',
    issuedAt:            PAST,
    status:              'pending_upload',
    createdAt:           NOW,
    updatedAt:           NOW,
    ...overrides,
  });
}

function makeVerified(overrides?: Partial<TeacherCertificationProps>): TeacherCertification {
  return make({
    status:     'verified',
    verifiedAt: NOW,
    verifiedBy: 'admin@studio.com',
    documentUrl: 'https://docs.example.com/cert.pdf',
    ...overrides,
  });
}

function makeUnderReview(overrides?: Partial<TeacherCertificationProps>): TeacherCertification {
  return make({ status: 'under_review', documentUrl: 'https://docs.example.com/cert.pdf', ...overrides });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('TeacherCertification — constructor', () => {
  it('creates pending_upload certification', () => {
    const c = make();
    expect(c.id).toBe('cert-1');
    expect(c.status).toBe('pending_upload');
    expect(c.isVerified()).toBe(false);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when teacherId is empty', () => {
    expect(() => make({ teacherId: '' })).toThrow('teacherId is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when issuingOrganization is empty', () => {
    expect(() => make({ issuingOrganization: '' })).toThrow('issuingOrganization is required');
  });

  it('throws when expiresAt is not after issuedAt', () => {
    expect(() => make({ expiresAt: PAST })).toThrow('expiresAt must be after issuedAt');
  });

  it('accepts expiresAt in the future', () => {
    expect(() => make({ expiresAt: FUTURE })).not.toThrow();
  });

  it('throws when verified without verifiedAt', () => {
    expect(() => make({ status: 'verified', verifiedBy: 'admin@x.com' }))
      .toThrow('verified certification must have verifiedAt');
  });

  it('throws when verified without verifiedBy', () => {
    expect(() => make({ status: 'verified', verifiedAt: NOW }))
      .toThrow('verified certification must have verifiedBy');
  });

  it('throws when rejected without rejectionReason', () => {
    expect(() => make({ status: 'rejected' }))
      .toThrow('rejected certification must have rejectionReason');
  });
});

// ── All certification types accepted ─────────────────────────────────────────

describe('certification types', () => {
  const allTypes: CertificationType[] = [
    'ryt_200','ryt_500','e_ryt_200','e_ryt_500',
    'cpr_first_aid','cpr_aed','child_protection',
    'insurance_liability','prenatal_certification',
    'therapeutic_yoga','aerial_yoga','hot_yoga','kids_yoga','yoga_therapy',
  ];
  it.each(allTypes)('accepts type: %s', (type) => {
    expect(() => make({ type })).not.toThrow();
  });
});

// ── submitForReview() ─────────────────────────────────────────────────────────

describe('submitForReview()', () => {
  it('transitions pending_upload to under_review', () => {
    const c = make().submitForReview('https://docs.example.com/cert.pdf', LATER);
    expect(c.status).toBe('under_review');
    expect(c.documentUrl).toBe('https://docs.example.com/cert.pdf');
    expect(c.updatedAt).toEqual(LATER);
  });

  it('throws when documentUrl is empty', () => {
    expect(() => make().submitForReview('', NOW)).toThrow('documentUrl is required');
  });

  it('throws when not pending_upload', () => {
    expect(() => makeUnderReview().submitForReview('doc.pdf', NOW))
      .toThrow('can only submit a pending_upload certification');
  });
});

// ── verify() ─────────────────────────────────────────────────────────────────

describe('verify()', () => {
  it('transitions under_review to verified', () => {
    const c = makeUnderReview().verify('admin@studio.com', LATER);
    expect(c.status).toBe('verified');
    expect(c.verifiedBy).toBe('admin@studio.com');
    expect(c.verifiedAt).toEqual(LATER);
  });

  it('throws when verifiedBy is empty', () => {
    expect(() => makeUnderReview().verify('', NOW)).toThrow('verifiedBy is required');
  });

  it('throws when not under_review', () => {
    expect(() => make().verify('admin@studio.com', NOW))
      .toThrow('can only verify an under_review certification');
  });
});

// ── reject() ─────────────────────────────────────────────────────────────────

describe('reject()', () => {
  it('transitions under_review to rejected', () => {
    const c = makeUnderReview().reject('Document too blurry', LATER);
    expect(c.status).toBe('rejected');
    expect(c.rejectionReason).toBe('Document too blurry');
  });

  it('throws when reason is empty', () => {
    expect(() => makeUnderReview().reject('', NOW)).toThrow('rejection reason is required');
  });

  it('throws when not under_review', () => {
    expect(() => makeVerified().reject('reason', NOW))
      .toThrow('can only reject an under_review certification');
  });
});

// ── resubmit() ────────────────────────────────────────────────────────────────

describe('resubmit()', () => {
  const rejected = make({ status: 'rejected', rejectionReason: 'Blurry' });

  it('transitions rejected to under_review', () => {
    const c = rejected.resubmit('https://docs.example.com/cert-v2.pdf', LATER);
    expect(c.status).toBe('under_review');
    expect(c.documentUrl).toBe('https://docs.example.com/cert-v2.pdf');
    expect(c.rejectionReason).toBeUndefined();
  });

  it('throws when documentUrl is empty', () => {
    expect(() => rejected.resubmit('', NOW)).toThrow('documentUrl is required');
  });

  it('throws when not rejected', () => {
    expect(() => makeVerified().resubmit('doc.pdf', NOW))
      .toThrow('can only resubmit a rejected certification');
  });
});

// ── expire() ─────────────────────────────────────────────────────────────────

describe('expire()', () => {
  it('transitions verified to expired', () => {
    const c = makeVerified().expire(LATER);
    expect(c.status).toBe('expired');
    expect(c.isExpired()).toBe(true);
  });

  it('throws when not verified', () => {
    expect(() => make().expire(NOW)).toThrow('can only expire a verified certification');
  });
});

// ── sendReminder() ────────────────────────────────────────────────────────────

describe('sendReminder()', () => {
  it('sets reminderSentAt on a verified cert with expiry', () => {
    const c = makeVerified({ expiresAt: FUTURE }).sendReminder(LATER);
    expect(c.reminderSentAt).toEqual(LATER);
  });

  it('throws when not verified', () => {
    expect(() => make({ expiresAt: FUTURE }).sendReminder(NOW))
      .toThrow('can only send reminder for a verified certification');
  });

  it('throws when cert has no expiry date', () => {
    expect(() => makeVerified().sendReminder(NOW))
      .toThrow('does not have an expiry date');
  });
});

// ── hasExpired() + daysUntilExpiry() ──────────────────────────────────────────

describe('hasExpired() and daysUntilExpiry()', () => {
  it('hasExpired returns false when no expiresAt', () => {
    expect(makeVerified().hasExpired(NOW)).toBe(false);
  });

  it('hasExpired returns false before expiry', () => {
    expect(makeVerified({ expiresAt: FUTURE }).hasExpired(NOW)).toBe(false);
  });

  it('hasExpired returns true on or after expiresAt', () => {
    expect(makeVerified({ expiresAt: NOW }).hasExpired(NOW)).toBe(true);
    expect(makeVerified({ expiresAt: NOW }).hasExpired(LATER)).toBe(true);
  });

  it('daysUntilExpiry returns undefined when no expiresAt', () => {
    expect(makeVerified().daysUntilExpiry(NOW)).toBeUndefined();
  });

  it('daysUntilExpiry returns positive days before expiry', () => {
    const expiry = new Date('2026-09-05T10:00:00Z'); // 31 days from NOW
    expect(makeVerified({ expiresAt: expiry }).daysUntilExpiry(NOW)).toBe(31);
  });

  it('daysUntilExpiry returns negative days after expiry', () => {
    const expiry = new Date('2026-08-01T10:00:00Z'); // 4 days before NOW
    expect(makeVerified({ expiresAt: expiry }).daysUntilExpiry(NOW)).toBe(-4);
  });
});

// ── Status helpers ────────────────────────────────────────────────────────────

describe('status helpers', () => {
  it('isPendingUpload is true for pending_upload', () => {
    expect(make().isPendingUpload()).toBe(true);
  });

  it('isUnderReview is true for under_review', () => {
    expect(makeUnderReview().isUnderReview()).toBe(true);
  });

  it('isVerified is true for verified', () => {
    expect(makeVerified().isVerified()).toBe(true);
  });

  it('isRejected is true for rejected', () => {
    expect(make({ status: 'rejected', rejectionReason: 'Blurry' }).isRejected()).toBe(true);
  });
});
