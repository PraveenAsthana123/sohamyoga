import { SocialLead, SocialLeadProps } from '../../../domain/identity/SocialLead';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides: Partial<SocialLeadProps> = {}): SocialLead {
  return new SocialLead({
    id:               'lead-1',
    source:           'facebook_lead_form',
    externalLeadId:   'fb-lead-9911',
    name:             'Ananya Krishnan',
    email:            'ananya@example.com',
    mobile:           '+14165551234',
    interest:         'stress_relief',
    adCampaignId:     'camp-2026-summer',
    status:           'new',
    duplicateOfId:    null,
    convertedToId:    null,
    marketingConsent: true,
    verifiedAt:       null,
    contactedAt:      null,
    convertedAt:      null,
    rawPayload:       { fbLeadId: 'fb-lead-9911' },
    tenantId:         'tenant-1',
    createdAt:        NOW,
    updatedAt:        NOW,
    ...overrides,
  });
}

describe('SocialLead', () => {
  describe('constructor', () => {
    it('creates with new status', () => {
      expect(make().status).toBe('new');
    });

    it('throws on invalid email', () => {
      expect(() => make({ email: 'notvalid' })).toThrow('email is invalid');
    });

    it('throws on blank name', () => {
      expect(() => make({ name: '' })).toThrow('name is required');
    });
  });

  describe('markContacted', () => {
    it('transitions new → contacted', () => {
      const lead = make().markContacted(NOW);
      expect(lead.status).toBe('contacted');
      expect(lead.contactedAt).toEqual(NOW);
    });

    it('throws if already converted', () => {
      expect(() =>
        make({ status: 'converted' }).markContacted(NOW)
      ).toThrow('converted');
    });

    it('throws if disqualified', () => {
      expect(() =>
        make({ status: 'disqualified' }).markContacted(NOW)
      ).toThrow('disqualified');
    });
  });

  describe('markVerified', () => {
    it('transitions contacted → verified', () => {
      const lead = make({ status: 'contacted' }).markVerified(NOW);
      expect(lead.status).toBe('verified');
      expect(lead.verifiedAt).toEqual(NOW);
    });

    it('throws if disqualified', () => {
      expect(() => make({ status: 'disqualified' }).markVerified(NOW)).toThrow('disqualified');
    });
  });

  describe('convert', () => {
    it('converts verified lead to customer', () => {
      const lead = make({ status: 'verified' }).convert('cust-99', LATER);
      expect(lead.status).toBe('converted');
      expect(lead.convertedToId).toBe('cust-99');
      expect(lead.convertedAt).toEqual(LATER);
    });

    it('throws if not verified', () => {
      expect(() => make({ status: 'contacted' }).convert('cust-1', LATER)).toThrow('verified');
    });

    it('throws on blank customerId', () => {
      expect(() => make({ status: 'verified' }).convert('  ', LATER)).toThrow('customerId is required');
    });
  });

  describe('markDuplicate', () => {
    it('marks as duplicate with reference ID', () => {
      const lead = make().markDuplicate('lead-0');
      expect(lead.status).toBe('duplicate');
      expect(lead.duplicateOfId).toBe('lead-0');
    });

    it('throws on blank duplicateOfId', () => {
      expect(() => make().markDuplicate('  ')).toThrow('duplicateOfId is required');
    });
  });

  describe('disqualify', () => {
    it('disqualifies an active lead', () => {
      expect(make().disqualify().status).toBe('disqualified');
    });

    it('throws disqualifying a converted lead', () => {
      expect(() => make({ status: 'converted' }).disqualify()).toThrow('converted');
    });
  });

  describe('isActive', () => {
    it('returns true for new/contacted/verified', () => {
      expect(make({ status: 'new' }).isActive()).toBe(true);
      expect(make({ status: 'contacted' }).isActive()).toBe(true);
      expect(make({ status: 'verified' }).isActive()).toBe(true);
    });

    it('returns false for converted/disqualified/duplicate', () => {
      expect(make({ status: 'converted' }).isActive()).toBe(false);
      expect(make({ status: 'disqualified' }).isActive()).toBe(false);
      expect(make({ status: 'duplicate' }).isActive()).toBe(false);
    });
  });

  describe('immutability', () => {
    it('returns a new instance on state change', () => {
      const a = make();
      const b = a.markContacted(NOW);
      expect(a.status).toBe('new');
      expect(b.status).toBe('contacted');
    });
  });
});
