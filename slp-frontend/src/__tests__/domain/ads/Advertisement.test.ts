import { describe, it, expect } from '@jest/globals';
import { Advertisement, type AdProps } from '../../../domain/ads/Advertisement';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function makeAd(overrides: Partial<AdProps> = {}): Advertisement {
  return new Advertisement({
    id:              'ad-1',
    adGroupId:       'ag-1',
    name:            'Yoga Summer RSA',
    adType:          'responsive_search',
    status:          'active',
    headlines:       ['Best Yoga Classes', 'Join Our Studio', 'Start Your Journey'],
    descriptions:    ['Expert instructors.', 'Book your first class today.'],
    imageUrls:       [],
    finalUrl:        'https://sohamyoga.com/classes',
    aiGenerated:     false,
    impressionCount: 0,
    clickCount:      0,
    conversionCount: 0,
    spendCents:      0,
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('Advertisement — construction', () => {
  it('creates a valid ad', () => {
    const a = makeAd();
    expect(a.id).toBe('ad-1');
    expect(a.adType).toBe('responsive_search');
    expect(a.isActive()).toBe(true);
  });

  it('throws when id is missing', () => {
    expect(() => makeAd({ id: '' })).toThrow('id is required');
  });

  it('throws when adGroupId is missing', () => {
    expect(() => makeAd({ adGroupId: '' })).toThrow('adGroupId is required');
  });

  it('throws when name is missing', () => {
    expect(() => makeAd({ name: '' })).toThrow('name is required');
  });

  it('throws when finalUrl is missing', () => {
    expect(() => makeAd({ finalUrl: '' })).toThrow('finalUrl is required');
  });

  it('throws when no headlines', () => {
    expect(() => makeAd({ headlines: [] })).toThrow('at least 1 headline');
  });

  it('throws when more than 15 headlines', () => {
    expect(() => makeAd({ headlines: Array(16).fill('H') })).toThrow('maximum 15 headlines');
  });

  it('throws when no descriptions', () => {
    expect(() => makeAd({ descriptions: [] })).toThrow('at least 1 description');
  });

  it('throws when more than 4 descriptions', () => {
    expect(() => makeAd({ descriptions: Array(5).fill('D') })).toThrow('maximum 4 descriptions');
  });

  it('throws when impressionCount is negative', () => {
    expect(() => makeAd({ impressionCount: -1 })).toThrow('cannot be negative');
  });

  it('throws when clickCount > impressionCount', () => {
    expect(() => makeAd({ impressionCount: 5, clickCount: 10 }))
      .toThrow('cannot exceed impressionCount');
  });

  it('accepts clickCount == impressionCount', () => {
    expect(() => makeAd({ impressionCount: 5, clickCount: 5 })).not.toThrow();
  });

  it('accepts ai-generated ad with generatedBy', () => {
    const a = makeAd({ aiGenerated: true, generatedBy: 'ollama' });
    expect(a.aiGenerated).toBe(true);
    expect(a.generatedBy).toBe('ollama');
  });
});

// ── Ad types ──────────────────────────────────────────────────────────────────

describe('AdType variety', () => {
  const types = ['responsive_search','display','banner','video','image','dynamic','call'] as const;
  it.each(types)('accepts adType %s', t => {
    expect(() => makeAd({ adType: t })).not.toThrow();
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isActive',      () => expect(makeAd({ status: 'active'       }).isActive()).toBe(true));
  it('isPaused',      () => expect(makeAd({ status: 'paused'       }).isPaused()).toBe(true));
  it('isRemoved',     () => expect(makeAd({ status: 'removed'      }).isRemoved()).toBe(true));
  it('isUnderReview', () => expect(makeAd({ status: 'under_review' }).isUnderReview()).toBe(true));
});

// ── Computed metrics ──────────────────────────────────────────────────────────

describe('computed metrics', () => {
  it('ctr = clicks / impressions', () => {
    const a = makeAd({ impressionCount: 1000, clickCount: 50 });
    expect(a.ctr()).toBeCloseTo(0.05);
  });

  it('ctr returns 0 when impressions = 0', () => {
    expect(makeAd().ctr()).toBe(0);
  });

  it('cpc = spendCents / clicks', () => {
    const a = makeAd({ impressionCount: 100, clickCount: 10, spendCents: 500 });
    expect(a.cpc()).toBe(50);
  });

  it('cpc returns 0 when clicks = 0', () => {
    expect(makeAd().cpc()).toBe(0);
  });

  it('conversionRate = conversions / clicks', () => {
    const a = makeAd({ impressionCount: 100, clickCount: 20, conversionCount: 4 });
    expect(a.conversionRate()).toBeCloseTo(0.2);
  });

  it('conversionRate returns 0 when clicks = 0', () => {
    expect(makeAd().conversionRate()).toBe(0);
  });
});

// ── Status transitions ────────────────────────────────────────────────────────

describe('activate()', () => {
  it('activates from paused', () => {
    expect(makeAd({ status: 'paused' }).activate(LATER).status).toBe('active');
  });

  it('activates from under_review', () => {
    expect(makeAd({ status: 'under_review' }).activate(LATER).status).toBe('active');
  });

  it('throws when already active', () => {
    expect(() => makeAd({ status: 'active' }).activate(LATER)).toThrow('already active');
  });

  it('throws when removed', () => {
    expect(() => makeAd({ status: 'removed' }).activate(LATER)).toThrow('cannot activate a removed');
  });

  it('does not mutate original', () => {
    const a = makeAd({ status: 'paused' });
    a.activate(LATER);
    expect(a.isPaused()).toBe(true);
  });
});

describe('pause()', () => {
  it('pauses an active ad', () => {
    expect(makeAd({ status: 'active' }).pause(LATER).status).toBe('paused');
  });

  it('throws when not active', () => {
    expect(() => makeAd({ status: 'paused' }).pause(LATER)).toThrow('can only pause an active');
  });
});

describe('remove()', () => {
  it('removes an active ad', () => {
    expect(makeAd({ status: 'active' }).remove(LATER).status).toBe('removed');
  });

  it('removes a paused ad', () => {
    expect(makeAd({ status: 'paused' }).remove(LATER).status).toBe('removed');
  });

  it('throws when already removed', () => {
    expect(() => makeAd({ status: 'removed' }).remove(LATER)).toThrow('already removed');
  });
});

describe('submitForReview()', () => {
  it('submits from active', () => {
    expect(makeAd({ status: 'active' }).submitForReview(LATER).status).toBe('under_review');
  });

  it('submits from paused', () => {
    expect(makeAd({ status: 'paused' }).submitForReview(LATER).status).toBe('under_review');
  });

  it('throws when already under review', () => {
    expect(() => makeAd({ status: 'under_review' }).submitForReview(LATER)).toThrow('already under review');
  });

  it('throws when removed', () => {
    expect(() => makeAd({ status: 'removed' }).submitForReview(LATER)).toThrow('cannot submit a removed');
  });
});

// ── Content updates ───────────────────────────────────────────────────────────

describe('updateHeadlines()', () => {
  it('updates headlines', () => {
    const a = makeAd().updateHeadlines(['New Headline'], LATER);
    expect(a.headlines).toEqual(['New Headline']);
  });

  it('throws on empty headlines', () => {
    expect(() => makeAd().updateHeadlines([], LATER)).toThrow('at least 1 headline');
  });

  it('throws on > 15 headlines', () => {
    expect(() => makeAd().updateHeadlines(Array(16).fill('H'), LATER)).toThrow('maximum 15');
  });

  it('defensive copy — mutation of returned array does not affect ad', () => {
    const a = makeAd();
    a.headlines.push('spy');
    expect(a.headlines).toHaveLength(3);
  });
});

describe('updateDescriptions()', () => {
  it('updates descriptions', () => {
    const a = makeAd().updateDescriptions(['New desc.'], LATER);
    expect(a.descriptions).toEqual(['New desc.']);
  });

  it('throws on empty descriptions', () => {
    expect(() => makeAd().updateDescriptions([], LATER)).toThrow('at least 1 description');
  });

  it('throws on > 4 descriptions', () => {
    expect(() => makeAd().updateDescriptions(Array(5).fill('D'), LATER)).toThrow('maximum 4');
  });
});

// ── Metric recording ──────────────────────────────────────────────────────────

describe('recordImpression()', () => {
  it('increments impressionCount', () => {
    expect(makeAd().recordImpression(LATER).impressionCount).toBe(1);
  });

  it('does not mutate original', () => {
    const a = makeAd();
    a.recordImpression(LATER);
    expect(a.impressionCount).toBe(0);
  });
});

describe('recordClick()', () => {
  it('increments clickCount and ensures impressionCount >= clickCount', () => {
    const a = makeAd().recordClick(LATER);
    expect(a.clickCount).toBe(1);
    expect(a.impressionCount).toBeGreaterThanOrEqual(1);
  });
});

describe('recordConversion()', () => {
  it('increments conversions and spend', () => {
    const a = makeAd().recordConversion(200, LATER);
    expect(a.conversionCount).toBe(1);
    expect(a.spendCents).toBe(200);
  });

  it('throws when spendCents is negative', () => {
    expect(() => makeAd().recordConversion(-1, LATER)).toThrow('cannot be negative');
  });
});
