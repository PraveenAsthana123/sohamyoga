import { describe, it, expect } from '@jest/globals';
import { MilestoneReward, type MilestoneRewardProps } from '../../../domain/journey/MilestoneReward';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');
const PAST   = new Date('2026-08-04T10:00:00Z');

function makeReward(overrides: Partial<MilestoneRewardProps> = {}): MilestoneReward {
  return new MilestoneReward({
    id:            'ms-1',
    customerId:    'cust-1',
    journeyId:     'jrn-1',
    milestoneType: 'streak_7',
    label:         '7-Day Streak',
    rewardType:    'badge',
    rewardValue:   'streak_7_badge',
    claimed:       false,
    achievedAt:    NOW,
    metadata:      {},
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('MilestoneReward — construction', () => {
  it('creates a valid reward', () => {
    const r = makeReward();
    expect(r.milestoneType).toBe('streak_7');
    expect(r.rewardType).toBe('badge');
    expect(r.claimed).toBe(false);
  });

  it('throws when id is missing', () => {
    expect(() => makeReward({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is missing', () => {
    expect(() => makeReward({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when journeyId is missing', () => {
    expect(() => makeReward({ journeyId: '' })).toThrow('journeyId is required');
  });

  it('throws when label is missing', () => {
    expect(() => makeReward({ label: '' })).toThrow('label is required');
  });

  it('throws when rewardValue is missing', () => {
    expect(() => makeReward({ rewardValue: '' })).toThrow('rewardValue is required');
  });

  it('throws when claimed but no claimedAt', () => {
    expect(() => makeReward({ claimed: true })).toThrow('claimedAt');
  });

  it('accepts claimed with claimedAt', () => {
    expect(() => makeReward({ claimed: true, claimedAt: LATER })).not.toThrow();
  });

  it('throws when expiresAt <= achievedAt', () => {
    expect(() => makeReward({ expiresAt: NOW })).toThrow('after achievedAt');
  });

  it('accepts expiresAt after achievedAt', () => {
    expect(() => makeReward({ expiresAt: FUTURE })).not.toThrow();
  });

  it('metadata is a defensive copy', () => {
    const meta = { source: 'system' };
    const r = makeReward({ metadata: meta });
    r.metadata.extra = 'spy';
    expect(r.metadata).not.toHaveProperty('extra');
  });
});

// ── MilestoneType variety ─────────────────────────────────────────────────────

describe('MilestoneType variety', () => {
  const types = [
    'first_class','streak_7','streak_30','streak_90','streak_365',
    'classes_10','classes_50','classes_100','classes_500',
    'goal_achieved','phase_advanced','year_anniversary','referral_bonus',
  ] as const;

  it.each(types)('accepts milestoneType %s', t => {
    expect(() => makeReward({ milestoneType: t })).not.toThrow();
  });
});

// ── RewardType variety ────────────────────────────────────────────────────────

describe('RewardType variety', () => {
  const types = ['badge','points','coupon','free_class','certificate','gift'] as const;
  it.each(types)('accepts rewardType %s', t => {
    expect(() => makeReward({ rewardType: t })).not.toThrow();
  });
});

// ── isExpired() ───────────────────────────────────────────────────────────────

describe('isExpired()', () => {
  it('returns false when no expiresAt', () => {
    expect(makeReward().isExpired(FUTURE)).toBe(false);
  });

  it('returns false before expiresAt', () => {
    expect(makeReward({ expiresAt: FUTURE }).isExpired(LATER)).toBe(false);
  });

  it('returns true when now >= expiresAt', () => {
    expect(makeReward({ expiresAt: FUTURE }).isExpired(FUTURE)).toBe(true);
    expect(makeReward({ expiresAt: FUTURE }).isExpired(new Date(FUTURE.getTime() + 1))).toBe(true);
  });
});

// ── isClaimed() ───────────────────────────────────────────────────────────────

describe('isClaimed()', () => {
  it('returns false when not claimed', () => {
    expect(makeReward().isClaimed()).toBe(false);
  });

  it('returns true when claimed', () => {
    expect(makeReward({ claimed: true, claimedAt: LATER }).isClaimed()).toBe(true);
  });
});

// ── claim() ───────────────────────────────────────────────────────────────────

describe('claim()', () => {
  it('claims an unclaimed reward', () => {
    const r = makeReward().claim(LATER);
    expect(r.claimed).toBe(true);
    expect(r.claimedAt).toEqual(LATER);
  });

  it('throws when already claimed', () => {
    expect(() => makeReward({ claimed: true, claimedAt: LATER }).claim(NOW))
      .toThrow('already claimed');
  });

  it('throws when expired', () => {
    expect(() => makeReward({ expiresAt: FUTURE }).claim(new Date(FUTURE.getTime() + 1)))
      .toThrow('expired');
  });

  it('does not mutate original', () => {
    const r = makeReward();
    r.claim(LATER);
    expect(r.claimed).toBe(false);
  });

  it('can claim immediately at achievedAt', () => {
    expect(() => makeReward().claim(NOW)).not.toThrow();
  });

  it('can claim right before expiry', () => {
    const r = makeReward({ expiresAt: FUTURE }).claim(new Date(FUTURE.getTime() - 1));
    expect(r.claimed).toBe(true);
  });
});
