import { describe, it, expect } from '@jest/globals';
import {
  CampaignBrief,
  CampaignBriefProps,
  CampaignObjective,
  CampaignOfferType,
  ContentSequenceStep,
} from '../../../domain/marketing/CampaignBrief';

const T0 = new Date('2026-03-01T00:00:00Z');
const T1 = new Date('2026-03-15T00:00:00Z');
const T2 = new Date('2026-04-15T00:00:00Z');
const T3 = new Date('2026-04-30T00:00:00Z');

function make(overrides: Partial<CampaignBriefProps> = {}): CampaignBrief {
  return new CampaignBrief({
    id:               'cb-1',
    tenantId:         'tenant-1',
    name:             'Spring Membership Drive',
    description:      'Annual membership acquisition',
    objective:        'registration',
    offerType:        'membership',
    targetPersona:    ['adult', 'beginner'],
    channels:         ['instagram', 'email', 'sms'],
    contentSequence:  ['teaser', 'launch', 'reminder'],
    budgetPlannedCAD: 500,
    budgetActualCAD:  0,
    startDate:        T1,
    endDate:          T2,
    status:           'draft',
    utmCampaign:      'spring_membership_2026',
    createdBy:        'admin-1',
    createdAt:        T0,
    updatedAt:        T0,
    ...overrides,
  });
}

// ── Constructor validation ─────────────────────────────────────────────────────

describe('CampaignBrief — constructor validation', () => {
  it('constructs a valid brief', () => {
    const cb = make();
    expect(cb.id).toBe('cb-1');
    expect(cb.objective).toBe('registration');
    expect(cb.status).toBe('draft');
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when name is blank', () => {
    expect(() => make({ name: '   ' })).toThrow('name is required');
  });

  it('throws when channels is empty', () => {
    expect(() => make({ channels: [] })).toThrow('at least one channel is required');
  });

  it('throws when endDate is not after startDate', () => {
    expect(() => make({ endDate: T1 })).toThrow('endDate must be after startDate');
  });

  it('throws when endDate equals startDate', () => {
    expect(() => make({ startDate: T1, endDate: T1 })).toThrow('endDate must be after startDate');
  });

  it('throws when budgetPlannedCAD is negative', () => {
    expect(() => make({ budgetPlannedCAD: -1 })).toThrow('budgetPlannedCAD must be >= 0');
  });

  it('throws when budgetActualCAD is negative', () => {
    expect(() => make({ budgetActualCAD: -1 })).toThrow('budgetActualCAD must be >= 0');
  });

  it('throws when utmCampaign is not slug format', () => {
    expect(() => make({ utmCampaign: 'Spring Membership 2026' }))
      .toThrow('utmCampaign must be slug format');
  });

  it('throws when utmCampaign starts with a number', () => {
    expect(() => make({ utmCampaign: '2026spring' })).toThrow('utmCampaign must be slug format');
  });

  it('accepts utmCampaign with hyphens', () => {
    expect(() => make({ utmCampaign: 'spring-2026-drive' })).not.toThrow();
  });

  it('throws when status is approved without approvedBy', () => {
    expect(() => make({ status: 'approved' })).toThrow('approvedBy required when status is approved');
  });

  it('throws when status is active without approvedBy', () => {
    expect(() => make({ status: 'active' })).toThrow('approvedBy required when status is active');
  });

  it('accepts approved status with approvedBy', () => {
    expect(() => make({ status: 'approved', approvedBy: 'mgr-1' })).not.toThrow();
  });
});

// ── Getters & helpers ──────────────────────────────────────────────────────────

describe('CampaignBrief — getters and helpers', () => {
  it('returns immutable copy of channels', () => {
    const cb = make();
    const ch = cb.channels;
    ch.push('tiktok');
    expect(cb.channels).toHaveLength(3);
  });

  it('returns immutable copy of targetPersona', () => {
    const cb = make();
    cb.targetPersona.push('senior');
    expect(cb.targetPersona).toHaveLength(2);
  });

  it('budgetUtilizationPct returns 0 when no spend', () => {
    expect(make().budgetUtilizationPct()).toBe(0);
  });

  it('budgetUtilizationPct returns 50 when half spent', () => {
    const cb = make({ budgetActualCAD: 250 });
    expect(cb.budgetUtilizationPct()).toBe(50);
  });

  it('budgetUtilizationPct caps at 100 when overspent', () => {
    const cb = make({ budgetActualCAD: 1000 });
    expect(cb.budgetUtilizationPct()).toBe(100);
  });

  it('budgetUtilizationPct is 0 when planned is 0', () => {
    const cb = make({ budgetPlannedCAD: 0, budgetActualCAD: 0 });
    expect(cb.budgetUtilizationPct()).toBe(0);
  });

  it('daysRemaining returns positive days', () => {
    const cb = make();
    const now = new Date('2026-04-01T00:00:00Z');
    expect(cb.daysRemaining(now)).toBeGreaterThan(0);
  });

  it('daysRemaining returns 0 after end date', () => {
    const cb = make();
    const after = new Date('2026-05-01T00:00:00Z');
    expect(cb.daysRemaining(after)).toBe(0);
  });
});

// ── Status predicates ──────────────────────────────────────────────────────────

describe('CampaignBrief — status predicates', () => {
  it('isDraft() is true for draft status', () => {
    expect(make().isDraft()).toBe(true);
    expect(make({ status: 'approved', approvedBy: 'mgr' }).isDraft()).toBe(false);
  });

  it('isActive() is true for active status', () => {
    expect(make({ status: 'active', approvedBy: 'mgr' }).isActive()).toBe(true);
  });

  it('isPaused() is true for paused status', () => {
    expect(make({ status: 'paused', approvedBy: 'mgr' }).isPaused()).toBe(true);
  });

  it('isCompleted() is true for completed status', () => {
    expect(make({ status: 'completed', approvedBy: 'mgr' }).isCompleted()).toBe(true);
  });

  it('isArchived() is true for archived status', () => {
    expect(make({ status: 'archived', approvedBy: 'mgr' }).isArchived()).toBe(true);
  });
});

// ── State transitions ──────────────────────────────────────────────────────────

describe('CampaignBrief — state transitions', () => {
  it('approve() transitions draft → approved', () => {
    const cb = make().approve('mgr-1', T1);
    expect(cb.status).toBe('approved');
    expect(cb.approvedBy).toBe('mgr-1');
    expect(cb.approvedAt).toEqual(T1);
    expect(cb.updatedAt).toEqual(T1);
  });

  it('approve() throws if not draft', () => {
    const cb = make({ status: 'approved', approvedBy: 'mgr' });
    expect(() => cb.approve('mgr-1', T1)).toThrow('Can only approve draft campaigns');
  });

  it('launch() transitions approved → active', () => {
    const cb = make().approve('mgr-1', T1).launch(T2);
    expect(cb.status).toBe('active');
    expect(cb.updatedAt).toEqual(T2);
  });

  it('launch() throws if not approved', () => {
    expect(() => make().launch(T2)).toThrow('Can only launch approved campaigns');
  });

  it('pause() transitions active → paused with reason', () => {
    const cb = make().approve('mgr-1', T1).launch(T2).pause('Compliance review', T3);
    expect(cb.status).toBe('paused');
    expect(cb.updatedAt).toEqual(T3);
  });

  it('pause() throws if not active', () => {
    const approved = make().approve('mgr-1', T1);
    expect(() => approved.pause('reason', T2)).toThrow('Can only pause active campaigns');
  });

  it('resume() transitions paused → active', () => {
    const cb = make().approve('mgr-1', T1).launch(T2).pause('reason', T3).resume(T3);
    expect(cb.status).toBe('active');
  });

  it('resume() throws if not paused', () => {
    const active = make().approve('mgr-1', T1).launch(T2);
    expect(() => active.resume(T3)).toThrow('Can only resume paused campaigns');
  });

  it('complete() transitions active → completed', () => {
    const cb = make().approve('mgr-1', T1).launch(T2).complete(T3);
    expect(cb.status).toBe('completed');
  });

  it('complete() transitions paused → completed', () => {
    const cb = make().approve('mgr-1', T1).launch(T2).pause('reason', T3).complete(T3);
    expect(cb.status).toBe('completed');
  });

  it('complete() throws from draft', () => {
    expect(() => make().complete(T3)).toThrow('Can only complete active or paused campaigns');
  });

  it('archive() transitions any non-archived status → archived', () => {
    expect(make().archive(T1).status).toBe('archived');
    expect(make({ status: 'completed', approvedBy: 'mgr' }).archive(T1).status).toBe('archived');
  });

  it('archive() throws if already archived', () => {
    const cb = make().archive(T1);
    expect(() => cb.archive(T2)).toThrow('Campaign is already archived');
  });

  it('recordSpend() accumulates spend', () => {
    const cb = make().recordSpend(100, T1).recordSpend(50, T2);
    expect(cb.budgetActualCAD).toBe(150);
  });

  it('recordSpend() throws for negative amount', () => {
    expect(() => make().recordSpend(-10, T1)).toThrow('spend amount must be >= 0');
  });
});

// ── Immutability ───────────────────────────────────────────────────────────────

describe('CampaignBrief — immutability', () => {
  it('approve() returns new instance, does not mutate original', () => {
    const original = make();
    const approved = original.approve('mgr-1', T1);
    expect(original.status).toBe('draft');
    expect(approved.status).toBe('approved');
    expect(original).not.toBe(approved);
  });

  it('launch() returns new instance', () => {
    const approved = make().approve('mgr-1', T1);
    const active   = approved.launch(T2);
    expect(approved.status).toBe('approved');
    expect(active.status).toBe('active');
  });
});
