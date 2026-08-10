import { describe, it, expect } from '@jest/globals';
import { AdAnalytics, type AdAnalyticsProps } from '../../../domain/ads/AdAnalytics';

const START = new Date('2026-08-01T00:00:00Z');
const END   = new Date('2026-08-07T23:59:59Z');

function makeAnalytics(overrides: Partial<AdAnalyticsProps> = {}): AdAnalytics {
  return new AdAnalytics({
    id:           'ana-1',
    campaignId:   'camp-1',
    period:       { start: START, end: END },
    clicks:       0,
    impressions:  0,
    conversions:  0,
    spendCents:   0,
    revenueCents: 0,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('AdAnalytics — construction', () => {
  it('creates with all zeros', () => {
    const a = makeAnalytics();
    expect(a.clicks).toBe(0);
    expect(a.ctr).toBe(0);
  });

  it('throws when id is missing', () => {
    expect(() => makeAnalytics({ id: '' })).toThrow('id is required');
  });

  it('throws when campaignId is missing', () => {
    expect(() => makeAnalytics({ campaignId: '' })).toThrow('campaignId is required');
  });

  it('throws when period end <= start', () => {
    expect(() => makeAnalytics({ period: { start: END, end: START } }))
      .toThrow('period end must be after start');
  });

  it('throws when clicks < 0', () => {
    expect(() => makeAnalytics({ clicks: -1 })).toThrow('cannot be negative');
  });

  it('throws when impressions < 0', () => {
    expect(() => makeAnalytics({ impressions: -1 })).toThrow('cannot be negative');
  });

  it('throws when conversions < 0', () => {
    expect(() => makeAnalytics({ conversions: -1 })).toThrow('cannot be negative');
  });

  it('throws when spendCents < 0', () => {
    expect(() => makeAnalytics({ spendCents: -1 })).toThrow('cannot be negative');
  });

  it('throws when revenueCents < 0', () => {
    expect(() => makeAnalytics({ revenueCents: -1 })).toThrow('cannot be negative');
  });

  it('throws when clicks > impressions (non-zero impressions)', () => {
    expect(() => makeAnalytics({ impressions: 5, clicks: 10 }))
      .toThrow('cannot exceed impressions');
  });

  it('accepts clicks == impressions', () => {
    expect(() => makeAnalytics({ impressions: 10, clicks: 10 })).not.toThrow();
  });

  it('accepts clicks > 0 when impressions = 0', () => {
    expect(() => makeAnalytics({ impressions: 0, clicks: 5 })).not.toThrow();
  });

  it('stores adGroupId and adId optionally', () => {
    const a = makeAnalytics({ adGroupId: 'ag-1', adId: 'ad-1' });
    expect(a.adGroupId).toBe('ag-1');
    expect(a.adId).toBe('ad-1');
  });

  it('period is a defensive copy', () => {
    const period = { start: START, end: END };
    const a = makeAnalytics({ period });
    period.start = END;
    expect(a.period.start).toEqual(START);
  });
});

// ── Computed metrics ──────────────────────────────────────────────────────────

describe('CTR', () => {
  it('computes ctr = clicks / impressions', () => {
    const a = makeAnalytics({ impressions: 1000, clicks: 50 });
    expect(a.ctr).toBeCloseTo(0.05);
  });

  it('returns 0 when impressions = 0', () => {
    expect(makeAnalytics().ctr).toBe(0);
  });
});

describe('CPC', () => {
  it('computes cpc = spendCents / clicks', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 10, spendCents: 500 });
    expect(a.cpc).toBe(50);
  });

  it('returns 0 when clicks = 0', () => {
    expect(makeAnalytics().cpc).toBe(0);
  });
});

describe('CPM', () => {
  it('computes cpm = (spendCents / impressions) * 1000', () => {
    const a = makeAnalytics({ impressions: 10000, clicks: 100, spendCents: 500 });
    expect(a.cpm).toBeCloseTo(50);
  });

  it('returns 0 when impressions = 0', () => {
    expect(makeAnalytics().cpm).toBe(0);
  });
});

describe('CPA', () => {
  it('computes cpa = spendCents / conversions', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 10, conversions: 2, spendCents: 400 });
    expect(a.cpa).toBe(200);
  });

  it('returns 0 when conversions = 0', () => {
    expect(makeAnalytics().cpa).toBe(0);
  });
});

describe('ROAS', () => {
  it('computes roas = revenueCents / spendCents', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 10, spendCents: 500, revenueCents: 2000 });
    expect(a.roas).toBe(4);
  });

  it('returns 0 when spendCents = 0', () => {
    expect(makeAnalytics().roas).toBe(0);
  });
});

describe('conversionRate', () => {
  it('computes conversionRate = conversions / clicks', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 20, conversions: 4 });
    expect(a.conversionRate).toBeCloseTo(0.2);
  });

  it('returns 0 when clicks = 0', () => {
    expect(makeAnalytics().conversionRate).toBe(0);
  });
});

// ── addClicks() ───────────────────────────────────────────────────────────────

describe('addClicks()', () => {
  it('adds clicks', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 5 }).addClicks(3);
    expect(a.clicks).toBe(8);
  });

  it('throws when n < 0', () => {
    expect(() => makeAnalytics().addClicks(-1)).toThrow('must be non-negative');
  });

  it('accepts 0', () => {
    expect(() => makeAnalytics().addClicks(0)).not.toThrow();
  });

  it('does not mutate original', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 5 });
    a.addClicks(10);
    expect(a.clicks).toBe(5);
  });
});

// ── addImpressions() ──────────────────────────────────────────────────────────

describe('addImpressions()', () => {
  it('adds impressions', () => {
    expect(makeAnalytics().addImpressions(500).impressions).toBe(500);
  });

  it('throws when n < 0', () => {
    expect(() => makeAnalytics().addImpressions(-1)).toThrow('must be non-negative');
  });
});

// ── addConversion() ───────────────────────────────────────────────────────────

describe('addConversion()', () => {
  it('increments conversions and spend and revenue', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 10 }).addConversion(150, 600);
    expect(a.conversions).toBe(1);
    expect(a.spendCents).toBe(150);
    expect(a.revenueCents).toBe(600);
  });

  it('throws when spendCents < 0', () => {
    expect(() => makeAnalytics().addConversion(-1, 0)).toThrow('cannot be negative');
  });

  it('throws when revenueCents < 0', () => {
    expect(() => makeAnalytics().addConversion(0, -1)).toThrow('cannot be negative');
  });

  it('stacks multiple conversions', () => {
    const a = makeAnalytics({ impressions: 100, clicks: 10 })
      .addConversion(100, 400)
      .addConversion(200, 800);
    expect(a.conversions).toBe(2);
    expect(a.spendCents).toBe(300);
    expect(a.revenueCents).toBe(1200);
    expect(a.roas).toBe(4);
  });
});

// ── addSpend() ────────────────────────────────────────────────────────────────

describe('addSpend()', () => {
  it('adds spend without conversion', () => {
    expect(makeAnalytics().addSpend(250).spendCents).toBe(250);
  });

  it('throws when cents < 0', () => {
    expect(() => makeAnalytics().addSpend(-1)).toThrow('cannot be negative');
  });
});

// ── merge() ───────────────────────────────────────────────────────────────────

describe('merge()', () => {
  it('sums all counters', () => {
    const a = makeAnalytics({ impressions: 1000, clicks: 50, spendCents: 500, revenueCents: 2000 });
    const b = makeAnalytics({ impressions: 500,  clicks: 25, spendCents: 250, revenueCents: 1000 });
    const m = a.merge(b);
    expect(m.impressions).toBe(1500);
    expect(m.clicks).toBe(75);
    expect(m.spendCents).toBe(750);
    expect(m.revenueCents).toBe(3000);
    expect(m.roas).toBe(4);
  });

  it('throws when merging different campaigns', () => {
    const a = makeAnalytics({ campaignId: 'camp-1' });
    const b = makeAnalytics({ id: 'ana-2', campaignId: 'camp-2' });
    expect(() => a.merge(b)).toThrow('different campaigns');
  });
});
