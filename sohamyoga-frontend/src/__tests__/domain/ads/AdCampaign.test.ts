import { describe, it, expect } from '@jest/globals';
import { AdCampaign, type CampaignProps } from '../../../domain/ads/AdCampaign';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

function makeCampaign(overrides: Partial<CampaignProps> = {}): AdCampaign {
  return new AdCampaign({
    id:               'camp-1',
    name:             'Yoga Summer Campaign',
    campaignType:     'search',
    status:           'draft',
    dailyBudgetCents: 5000,
    biddingStrategy:  'manual_cpc',
    geoTargets:       ['CA-ON'],
    deviceTargets:    ['desktop', 'mobile'],
    languageTargets:  ['en'],
    audienceTargets:  [],
    adGroupIds:       [],
    tags:             [],
    startDate:        NOW,
    createdAt:        NOW,
    updatedAt:        NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('AdCampaign — construction', () => {
  it('creates a valid campaign', () => {
    const c = makeCampaign();
    expect(c.id).toBe('camp-1');
    expect(c.campaignType).toBe('search');
    expect(c.isDraft()).toBe(true);
    expect(c.dailyBudgetCents).toBe(5000);
  });

  it('throws when id is missing', () => {
    expect(() => makeCampaign({ id: '' })).toThrow('id is required');
  });

  it('throws when name is missing', () => {
    expect(() => makeCampaign({ name: '' })).toThrow('name is required');
  });

  it('throws when dailyBudgetCents < 1', () => {
    expect(() => makeCampaign({ dailyBudgetCents: 0 })).toThrow('at least 1');
  });

  it('throws when totalBudgetCents < dailyBudgetCents', () => {
    expect(() => makeCampaign({ dailyBudgetCents: 5000, totalBudgetCents: 4999 }))
      .toThrow('totalBudgetCents must be >= dailyBudgetCents');
  });

  it('accepts totalBudgetCents equal to dailyBudgetCents', () => {
    expect(() => makeCampaign({ dailyBudgetCents: 5000, totalBudgetCents: 5000 })).not.toThrow();
  });

  it('throws when endDate is before startDate', () => {
    expect(() => makeCampaign({ endDate: new Date('2025-01-01') }))
      .toThrow('endDate must be after startDate');
  });

  it('throws when status is ended but endDate is missing', () => {
    expect(() => makeCampaign({ status: 'ended' }))
      .toThrow('ended campaign must have endDate');
  });

  it('accepts ended status with endDate', () => {
    expect(() => makeCampaign({ status: 'ended', endDate: FUTURE })).not.toThrow();
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isDraft', ()    => { expect(makeCampaign({ status: 'draft'    }).isDraft()).toBe(true);    });
  it('isActive', ()   => { expect(makeCampaign({ status: 'active'   }).isActive()).toBe(true);   });
  it('isPaused', ()   => { expect(makeCampaign({ status: 'paused'   }).isPaused()).toBe(true);   });
  it('isArchived', () => { expect(makeCampaign({ status: 'archived' }).isArchived()).toBe(true); });
  it('isEnded', ()    => { expect(makeCampaign({ status: 'ended', endDate: FUTURE }).isEnded()).toBe(true); });
});

// ── activate() ────────────────────────────────────────────────────────────────

describe('activate()', () => {
  it('activates from draft', () => {
    expect(makeCampaign({ status: 'draft' }).activate(LATER).status).toBe('active');
  });

  it('activates from paused', () => {
    expect(makeCampaign({ status: 'paused' }).activate(LATER).status).toBe('active');
  });

  it('throws when already active', () => {
    expect(() => makeCampaign({ status: 'active' }).activate(LATER)).toThrow('already active');
  });

  it('throws when archived', () => {
    expect(() => makeCampaign({ status: 'archived' }).activate(LATER)).toThrow('cannot activate an archived');
  });

  it('throws when ended', () => {
    expect(() => makeCampaign({ status: 'ended', endDate: FUTURE }).activate(LATER))
      .toThrow('cannot activate an ended');
  });

  it('does not mutate original', () => {
    const c = makeCampaign();
    c.activate(LATER);
    expect(c.isDraft()).toBe(true);
  });
});

// ── pause() ───────────────────────────────────────────────────────────────────

describe('pause()', () => {
  it('pauses an active campaign', () => {
    expect(makeCampaign({ status: 'active' }).pause(LATER).status).toBe('paused');
  });

  it('throws when not active', () => {
    expect(() => makeCampaign({ status: 'draft' }).pause(LATER)).toThrow('can only pause an active');
  });
});

// ── archive() ─────────────────────────────────────────────────────────────────

describe('archive()', () => {
  it('archives any non-archived campaign', () => {
    expect(makeCampaign({ status: 'active' }).archive(LATER).status).toBe('archived');
    expect(makeCampaign({ status: 'paused' }).archive(LATER).status).toBe('archived');
  });

  it('throws when already archived', () => {
    expect(() => makeCampaign({ status: 'archived' }).archive(LATER)).toThrow('already archived');
  });
});

// ── end() ─────────────────────────────────────────────────────────────────────

describe('end()', () => {
  it('ends an active campaign', () => {
    const c = makeCampaign({ status: 'active' }).end(FUTURE, LATER);
    expect(c.status).toBe('ended');
    expect(c.endDate).toEqual(FUTURE);
  });

  it('throws when already ended', () => {
    expect(() => makeCampaign({ status: 'ended', endDate: FUTURE }).end(FUTURE, LATER))
      .toThrow('already ended');
  });

  it('throws when endDate <= startDate', () => {
    expect(() => makeCampaign({ status: 'active' }).end(new Date('2025-01-01'), LATER))
      .toThrow('endDate must be after startDate');
  });
});

// ── Budget ────────────────────────────────────────────────────────────────────

describe('setDailyBudget()', () => {
  it('updates daily budget', () => {
    expect(makeCampaign().setDailyBudget(1000, LATER).dailyBudgetCents).toBe(1000);
  });

  it('throws when < 1', () => {
    expect(() => makeCampaign().setDailyBudget(0, LATER)).toThrow('at least 1');
  });

  it('throws when exceeds totalBudgetCents', () => {
    const c = makeCampaign({ dailyBudgetCents: 5000, totalBudgetCents: 10000 });
    expect(() => c.setDailyBudget(10001, LATER)).toThrow('cannot exceed totalBudgetCents');
  });
});

describe('setTotalBudget()', () => {
  it('sets total budget', () => {
    expect(makeCampaign().setTotalBudget(50000, LATER).totalBudgetCents).toBe(50000);
  });

  it('throws when < dailyBudgetCents', () => {
    expect(() => makeCampaign({ dailyBudgetCents: 5000 }).setTotalBudget(4999, LATER))
      .toThrow('totalBudgetCents must be >= dailyBudgetCents');
  });
});

// ── Bidding strategy ──────────────────────────────────────────────────────────

describe('setBiddingStrategy()', () => {
  const strategies = ['manual_cpc', 'target_cpa', 'target_roas', 'maximize_clicks', 'maximize_conversions'] as const;
  it.each(strategies)('sets strategy %s', s => {
    expect(makeCampaign().setBiddingStrategy(s, LATER).biddingStrategy).toBe(s);
  });
});

// ── Geo targeting ─────────────────────────────────────────────────────────────

describe('addGeoTarget() / removeGeoTarget()', () => {
  it('adds a geo target', () => {
    const c = makeCampaign({ geoTargets: [] }).addGeoTarget('CA-BC', LATER);
    expect(c.geoTargets).toContain('CA-BC');
  });

  it('throws on empty geo', () => {
    expect(() => makeCampaign().addGeoTarget('', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate geo', () => {
    expect(() => makeCampaign({ geoTargets: ['CA-ON'] }).addGeoTarget('CA-ON', LATER))
      .toThrow('"CA-ON" already exists');
  });

  it('removes a geo target', () => {
    const c = makeCampaign({ geoTargets: ['CA-ON', 'CA-BC'] }).removeGeoTarget('CA-ON', LATER);
    expect(c.geoTargets).not.toContain('CA-ON');
    expect(c.geoTargets).toContain('CA-BC');
  });

  it('throws when geo not found', () => {
    expect(() => makeCampaign().removeGeoTarget('US-NY', LATER)).toThrow('"US-NY" not found');
  });

  it('geoTargets is a defensive copy', () => {
    const c = makeCampaign({ geoTargets: ['CA-ON'] });
    c.geoTargets.push('spy');
    expect(c.geoTargets).toEqual(['CA-ON']);
  });
});

// ── Ad Groups ─────────────────────────────────────────────────────────────────

describe('addAdGroup() / removeAdGroup()', () => {
  it('adds an ad group', () => {
    const c = makeCampaign().addAdGroup('ag-1', LATER);
    expect(c.adGroupIds).toContain('ag-1');
  });

  it('throws on empty adGroupId', () => {
    expect(() => makeCampaign().addAdGroup('', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate', () => {
    const c = makeCampaign().addAdGroup('ag-1', LATER);
    expect(() => c.addAdGroup('ag-1', LATER)).toThrow('already added');
  });

  it('removes an ad group', () => {
    const c = makeCampaign().addAdGroup('ag-1', LATER).removeAdGroup('ag-1', LATER);
    expect(c.adGroupIds).not.toContain('ag-1');
  });

  it('throws when adGroup not found', () => {
    expect(() => makeCampaign().removeAdGroup('ag-ghost', LATER)).toThrow('not found');
  });
});

// ── Tags ──────────────────────────────────────────────────────────────────────

describe('addTag() / removeTag()', () => {
  it('adds a tag', () => {
    expect(makeCampaign().addTag('yoga', LATER).tags).toContain('yoga');
  });

  it('throws on empty tag', () => {
    expect(() => makeCampaign().addTag('', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate tag', () => {
    expect(() => makeCampaign({ tags: ['yoga'] }).addTag('yoga', LATER)).toThrow('already exists');
  });

  it('removes a tag', () => {
    const c = makeCampaign({ tags: ['yoga', 'summer'] }).removeTag('yoga', LATER);
    expect(c.tags).not.toContain('yoga');
    expect(c.tags).toContain('summer');
  });

  it('throws when tag not found', () => {
    expect(() => makeCampaign().removeTag('ghost', LATER)).toThrow('not found');
  });
});
