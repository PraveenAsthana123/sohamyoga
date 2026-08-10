import { describe, it, expect } from '@jest/globals';
import { AdGroup, type AdGroupProps } from '../../../domain/ads/AdGroup';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function makeGroup(overrides: Partial<AdGroupProps> = {}): AdGroup {
  return new AdGroup({
    id:              'ag-1',
    campaignId:      'camp-1',
    name:            'Yoga Beginners',
    status:          'active',
    defaultBidCents: 100,
    keywords:        [],
    adIds:           [],
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('AdGroup — construction', () => {
  it('creates a valid ad group', () => {
    const g = makeGroup();
    expect(g.id).toBe('ag-1');
    expect(g.campaignId).toBe('camp-1');
    expect(g.isActive()).toBe(true);
  });

  it('throws when id is missing', () => {
    expect(() => makeGroup({ id: '' })).toThrow('id is required');
  });

  it('throws when campaignId is missing', () => {
    expect(() => makeGroup({ campaignId: '' })).toThrow('campaignId is required');
  });

  it('throws when name is missing', () => {
    expect(() => makeGroup({ name: '' })).toThrow('name is required');
  });

  it('throws when defaultBidCents < 1', () => {
    expect(() => makeGroup({ defaultBidCents: 0 })).toThrow('at least 1');
  });

  it('throws when keyword has empty text', () => {
    expect(() => makeGroup({ keywords: [{ text: '', matchType: 'broad' }] }))
      .toThrow('keyword text cannot be empty');
  });

  it('throws when keyword bidAdjustmentPercent out of range', () => {
    expect(() => makeGroup({ keywords: [{ text: 'yoga', matchType: 'broad', bidAdjustmentPercent: -91 }] }))
      .toThrow('bidAdjustmentPercent must be -90 to 900');
    expect(() => makeGroup({ keywords: [{ text: 'yoga', matchType: 'broad', bidAdjustmentPercent: 901 }] }))
      .toThrow('bidAdjustmentPercent must be -90 to 900');
  });

  it('accepts boundary bidAdjustmentPercent values', () => {
    expect(() => makeGroup({ keywords: [{ text: 'yoga', matchType: 'broad', bidAdjustmentPercent: -90 }] })).not.toThrow();
    expect(() => makeGroup({ keywords: [{ text: 'yoga', matchType: 'broad', bidAdjustmentPercent: 900 }] })).not.toThrow();
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isActive',  () => expect(makeGroup({ status: 'active'  }).isActive()).toBe(true));
  it('isPaused',  () => expect(makeGroup({ status: 'paused'  }).isPaused()).toBe(true));
  it('isRemoved', () => expect(makeGroup({ status: 'removed' }).isRemoved()).toBe(true));
});

// ── Status transitions ────────────────────────────────────────────────────────

describe('activate()', () => {
  it('activates from paused', () => {
    expect(makeGroup({ status: 'paused' }).activate(LATER).status).toBe('active');
  });

  it('throws when already active', () => {
    expect(() => makeGroup({ status: 'active' }).activate(LATER)).toThrow('already active');
  });

  it('throws when removed', () => {
    expect(() => makeGroup({ status: 'removed' }).activate(LATER)).toThrow('cannot activate a removed');
  });

  it('does not mutate original', () => {
    const g = makeGroup({ status: 'paused' });
    g.activate(LATER);
    expect(g.isPaused()).toBe(true);
  });
});

describe('pause()', () => {
  it('pauses an active group', () => {
    expect(makeGroup({ status: 'active' }).pause(LATER).status).toBe('paused');
  });

  it('throws when not active', () => {
    expect(() => makeGroup({ status: 'paused' }).pause(LATER)).toThrow('can only pause an active');
  });
});

describe('remove()', () => {
  it('removes active group', () => {
    expect(makeGroup({ status: 'active'  }).remove(LATER).status).toBe('removed');
  });

  it('removes paused group', () => {
    expect(makeGroup({ status: 'paused' }).remove(LATER).status).toBe('removed');
  });

  it('throws when already removed', () => {
    expect(() => makeGroup({ status: 'removed' }).remove(LATER)).toThrow('already removed');
  });
});

// ── Default bid ───────────────────────────────────────────────────────────────

describe('setDefaultBid()', () => {
  it('updates default bid', () => {
    expect(makeGroup().setDefaultBid(250, LATER).defaultBidCents).toBe(250);
  });

  it('throws when < 1', () => {
    expect(() => makeGroup().setDefaultBid(0, LATER)).toThrow('at least 1');
  });
});

// ── Keywords ──────────────────────────────────────────────────────────────────

describe('addKeyword() / removeKeyword()', () => {
  it('adds a keyword', () => {
    const g = makeGroup().addKeyword({ text: 'yoga class', matchType: 'broad' }, LATER);
    expect(g.keywords).toHaveLength(1);
    expect(g.keywords[0].text).toBe('yoga class');
  });

  it('throws on empty keyword text', () => {
    expect(() => makeGroup().addKeyword({ text: '', matchType: 'broad' }, LATER))
      .toThrow('keyword text cannot be empty');
  });

  it('throws on duplicate keyword + matchType', () => {
    const g = makeGroup().addKeyword({ text: 'yoga', matchType: 'broad' }, LATER);
    expect(() => g.addKeyword({ text: 'yoga', matchType: 'broad' }, LATER))
      .toThrow('already exists');
  });

  it('allows same text with different matchType', () => {
    const g = makeGroup()
      .addKeyword({ text: 'yoga', matchType: 'broad' }, LATER)
      .addKeyword({ text: 'yoga', matchType: 'exact' }, LATER);
    expect(g.keywords).toHaveLength(2);
  });

  it('throws on out-of-range bidAdjustment', () => {
    expect(() => makeGroup().addKeyword({ text: 'yoga', matchType: 'broad', bidAdjustmentPercent: 999 }, LATER))
      .toThrow('bidAdjustmentPercent must be -90 to 900');
  });

  it('removes a keyword by text + matchType', () => {
    const g = makeGroup()
      .addKeyword({ text: 'yoga', matchType: 'broad' }, LATER)
      .addKeyword({ text: 'yoga', matchType: 'exact' }, LATER)
      .removeKeyword('yoga', 'broad', LATER);
    expect(g.keywords).toHaveLength(1);
    expect(g.keywords[0].matchType).toBe('exact');
  });

  it('throws when keyword not found', () => {
    expect(() => makeGroup().removeKeyword('ghost', 'broad', LATER)).toThrow('not found');
  });

  it('keywords is a defensive copy', () => {
    const g = makeGroup().addKeyword({ text: 'yoga', matchType: 'broad' }, LATER);
    g.keywords.push({ text: 'spy', matchType: 'exact' });
    expect(g.keywords).toHaveLength(1);
  });
});

// ── Ads ───────────────────────────────────────────────────────────────────────

describe('addAd() / removeAd()', () => {
  it('adds an ad', () => {
    expect(makeGroup().addAd('ad-1', LATER).adIds).toContain('ad-1');
  });

  it('throws on empty adId', () => {
    expect(() => makeGroup().addAd('', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate ad', () => {
    const g = makeGroup().addAd('ad-1', LATER);
    expect(() => g.addAd('ad-1', LATER)).toThrow('already added');
  });

  it('removes an ad', () => {
    const g = makeGroup().addAd('ad-1', LATER).addAd('ad-2', LATER).removeAd('ad-1', LATER);
    expect(g.adIds).not.toContain('ad-1');
    expect(g.adIds).toContain('ad-2');
  });

  it('throws when ad not found', () => {
    expect(() => makeGroup().removeAd('ghost', LATER)).toThrow('not found');
  });

  it('adIds is a defensive copy', () => {
    const g = makeGroup().addAd('ad-1', LATER);
    g.adIds.push('spy');
    expect(g.adIds).toEqual(['ad-1']);
  });
});
