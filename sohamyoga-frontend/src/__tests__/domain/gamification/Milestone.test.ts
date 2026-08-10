import { describe, it, expect } from '@jest/globals';
import {
  Milestone,
  Challenge,
  ChallengeParticipation,
  MILESTONE_CATALOG,
  type MilestoneProps,
  type ChallengeProps,
  type ChallengeParticipationProps,
} from '../../../domain/gamification/Milestone';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const T0  = new Date('2026-01-01T00:00:00Z');
const T1  = new Date('2026-01-02T00:00:00Z');
const T10 = new Date('2026-01-10T00:00:00Z');

function makeMilestone(overrides: Partial<MilestoneProps> = {}): Milestone {
  return new Milestone({
    id:              'ms-1',
    userId:          'u-1',
    milestoneType:   'class_count',
    threshold:       10,
    currentProgress: 0,
    status:          'locked',
    reward:          { xpAmount: 100, pointsAmount: 50 },
    createdAt:       T0,
    updatedAt:       T0,
    ...overrides,
  });
}

function makeChallenge(overrides: Partial<ChallengeProps> = {}): Challenge {
  return new Challenge({
    id:               'ch-1',
    tenantId:         'tenant-1',
    name:             'January Class Sprint',
    description:      'Attend as many classes as possible in January',
    type:             'group',
    status:           'upcoming',
    metric:           'classes_attended',
    targetValue:      20,
    startDate:        T1,
    endDate:          T10,
    participantCount: 0,
    reward:           { xpAmount: 200, pointsAmount: 100 },
    createdBy:        'u-admin',
    createdAt:        T0,
    updatedAt:        T0,
    ...overrides,
  });
}

function makeParticipation(overrides: Partial<ChallengeParticipationProps> = {}): ChallengeParticipation {
  return new ChallengeParticipation({
    challengeId:     'ch-1',
    userId:          'u-1',
    currentProgress: 0,
    joinedAt:        T0,
    updatedAt:       T0,
    ...overrides,
  });
}

// ── Milestone — constructor validation ───────────────────────────────────────

describe('Milestone — constructor', () => {
  it('creates a valid locked milestone', () => {
    const m = makeMilestone();
    expect(m.id).toBe('ms-1');
    expect(m.status).toBe('locked');
    expect(m.currentProgress).toBe(0);
    expect(m.threshold).toBe(10);
  });

  it('throws if id is missing', () => {
    expect(() => makeMilestone({ id: '' })).toThrow('id is required');
  });

  it('throws if userId is missing', () => {
    expect(() => makeMilestone({ userId: '' })).toThrow('userId is required');
  });

  it('throws if threshold is 0', () => {
    expect(() => makeMilestone({ threshold: 0 })).toThrow('threshold must be positive');
  });

  it('throws if threshold is negative', () => {
    expect(() => makeMilestone({ threshold: -5 })).toThrow('threshold must be positive');
  });

  it('throws if currentProgress is negative', () => {
    expect(() => makeMilestone({ currentProgress: -1 })).toThrow('currentProgress cannot be negative');
  });

  it('throws if status is earned but earnedAt is missing', () => {
    expect(() => makeMilestone({ status: 'earned' })).toThrow('earnedAt required');
  });

  it('throws if status is claimed but claimedAt is missing', () => {
    expect(() => makeMilestone({ status: 'claimed', earnedAt: T0 })).toThrow('claimedAt required');
  });

  it('throws if xpAmount is negative', () => {
    expect(() => makeMilestone({ reward: { xpAmount: -1, pointsAmount: 50 } })).toThrow('reward values must be non-negative');
  });

  it('accepts earned status with earnedAt', () => {
    const m = makeMilestone({ status: 'earned', currentProgress: 10, earnedAt: T1 });
    expect(m.status).toBe('earned');
    expect(m.earnedAt).toEqual(T1);
  });

  it('accepts claimed status with both earnedAt and claimedAt', () => {
    const m = makeMilestone({ status: 'claimed', currentProgress: 10, earnedAt: T1, claimedAt: T10 });
    expect(m.status).toBe('claimed');
    expect(m.claimedAt).toEqual(T10);
  });
});

// ── Milestone — progressPercent ───────────────────────────────────────────────

describe('Milestone — progressPercent()', () => {
  it('returns 0 when progress is 0', () => {
    expect(makeMilestone({ currentProgress: 0 }).progressPercent()).toBe(0);
  });

  it('returns 50 for halfway', () => {
    expect(makeMilestone({ currentProgress: 5 }).progressPercent()).toBe(50);
  });

  it('returns 100 when at threshold', () => {
    expect(makeMilestone({ currentProgress: 10 }).progressPercent()).toBe(100);
  });

  it('caps at 100 when over threshold', () => {
    expect(makeMilestone({ currentProgress: 15 }).progressPercent()).toBe(100);
  });
});

// ── Milestone — isComplete ────────────────────────────────────────────────────

describe('Milestone — isComplete()', () => {
  it('returns false before threshold', () => {
    expect(makeMilestone({ currentProgress: 9 }).isComplete()).toBe(false);
  });

  it('returns true at threshold', () => {
    expect(makeMilestone({ currentProgress: 10 }).isComplete()).toBe(true);
  });

  it('returns true above threshold', () => {
    expect(makeMilestone({ currentProgress: 11 }).isComplete()).toBe(true);
  });
});

// ── Milestone — advance() ─────────────────────────────────────────────────────

describe('Milestone — advance()', () => {
  it('transitions locked → in_progress', () => {
    const m2 = makeMilestone().advance(5, T1);
    expect(m2.status).toBe('in_progress');
    expect(m2.currentProgress).toBe(5);
    expect(m2.updatedAt).toEqual(T1);
  });

  it('auto-earns when progress reaches threshold', () => {
    const m2 = makeMilestone().advance(10, T1);
    expect(m2.status).toBe('earned');
    expect(m2.earnedAt).toEqual(T1);
  });

  it('auto-earns when progress exceeds threshold', () => {
    const m2 = makeMilestone().advance(15, T1);
    expect(m2.status).toBe('earned');
    expect(m2.currentProgress).toBe(15);
  });

  it('does not regress progress (clamps to max seen)', () => {
    const m2 = makeMilestone({ currentProgress: 7 }).advance(3, T1);
    expect(m2.currentProgress).toBe(7);
  });

  it('is a no-op if already earned', () => {
    const m2 = makeMilestone({ status: 'earned', currentProgress: 10, earnedAt: T1 }).advance(5, T10);
    expect(m2.status).toBe('earned');
    expect(m2.currentProgress).toBe(10);
  });

  it('is a no-op if already claimed', () => {
    const m2 = makeMilestone({ status: 'claimed', currentProgress: 10, earnedAt: T1, claimedAt: T10 }).advance(5, T10);
    expect(m2.status).toBe('claimed');
  });

  it('does not mutate original', () => {
    const original = makeMilestone();
    original.advance(5, T1);
    expect(original.currentProgress).toBe(0);
    expect(original.status).toBe('locked');
  });
});

// ── Milestone — claim() ───────────────────────────────────────────────────────

describe('Milestone — claim()', () => {
  it('transitions earned → claimed', () => {
    const earned = makeMilestone({ status: 'earned', currentProgress: 10, earnedAt: T1 });
    const claimed = earned.claim(T10);
    expect(claimed.status).toBe('claimed');
    expect(claimed.claimedAt).toEqual(T10);
  });

  it('throws if not yet earned', () => {
    expect(() => makeMilestone({ status: 'in_progress', currentProgress: 5 }).claim(T1))
      .toThrow('Can only claim earned milestones');
  });

  it('throws if locked', () => {
    expect(() => makeMilestone().claim(T1)).toThrow('Can only claim earned milestones');
  });

  it('does not mutate original', () => {
    const earned = makeMilestone({ status: 'earned', currentProgress: 10, earnedAt: T1 });
    earned.claim(T10);
    expect(earned.status).toBe('earned');
  });
});

// ── Milestone — isClaimed ─────────────────────────────────────────────────────

describe('Milestone — isClaimed()', () => {
  it('returns false for earned', () => {
    expect(makeMilestone({ status: 'earned', currentProgress: 10, earnedAt: T1 }).isClaimed()).toBe(false);
  });

  it('returns true for claimed', () => {
    const m = makeMilestone({ status: 'claimed', currentProgress: 10, earnedAt: T1, claimedAt: T10 });
    expect(m.isClaimed()).toBe(true);
  });
});

// ── MILESTONE_CATALOG ─────────────────────────────────────────────────────────

describe('MILESTONE_CATALOG', () => {
  it('has 13 entries', () => {
    expect(MILESTONE_CATALOG).toHaveLength(13);
  });

  it('every entry has a positive threshold', () => {
    MILESTONE_CATALOG.forEach(d => {
      expect(d.threshold).toBeGreaterThan(0);
    });
  });

  it('every entry has a non-empty label', () => {
    MILESTONE_CATALOG.forEach(d => {
      expect(d.label.length).toBeGreaterThan(0);
    });
  });

  it('every entry has non-negative reward values', () => {
    MILESTONE_CATALOG.forEach(d => {
      expect(d.reward.xpAmount).toBeGreaterThanOrEqual(0);
      expect(d.reward.pointsAmount).toBeGreaterThanOrEqual(0);
    });
  });

  it('contains a class_count milestone with threshold 100', () => {
    const m = MILESTONE_CATALOG.find(d => d.milestoneType === 'class_count' && d.threshold === 100);
    expect(m).toBeDefined();
  });

  it('contains a streak_days milestone with threshold 30', () => {
    const m = MILESTONE_CATALOG.find(d => d.milestoneType === 'streak_days' && d.threshold === 30);
    expect(m).toBeDefined();
  });
});

// ── Challenge — constructor validation ───────────────────────────────────────

describe('Challenge — constructor', () => {
  it('creates a valid upcoming challenge', () => {
    const c = makeChallenge();
    expect(c.id).toBe('ch-1');
    expect(c.status).toBe('upcoming');
    expect(c.participantCount).toBe(0);
  });

  it('throws if name is empty', () => {
    expect(() => makeChallenge({ name: '  ' })).toThrow('Challenge name is required');
  });

  it('throws if targetValue is 0', () => {
    expect(() => makeChallenge({ targetValue: 0 })).toThrow('targetValue must be positive');
  });

  it('throws if endDate is not after startDate', () => {
    expect(() => makeChallenge({ startDate: T10, endDate: T1 })).toThrow('endDate must be after startDate');
  });

  it('throws if endDate equals startDate', () => {
    expect(() => makeChallenge({ startDate: T1, endDate: T1 })).toThrow('endDate must be after startDate');
  });
});

// ── Challenge — isLive() ─────────────────────────────────────────────────────

describe('Challenge — isLive()', () => {
  const ACTIVE_START = new Date('2026-01-02T00:00:00Z');
  const ACTIVE_END   = new Date('2026-01-10T00:00:00Z');
  const NOW_MID      = new Date('2026-01-05T00:00:00Z');
  const NOW_BEFORE   = new Date('2026-01-01T00:00:00Z');
  const NOW_AFTER    = new Date('2026-01-11T00:00:00Z');

  it('returns true when active and within date range', () => {
    const c = makeChallenge({ status: 'active', startDate: ACTIVE_START, endDate: ACTIVE_END });
    expect(c.isLive(NOW_MID)).toBe(true);
  });

  it('returns false when upcoming', () => {
    expect(makeChallenge({ startDate: ACTIVE_START, endDate: ACTIVE_END }).isLive(NOW_MID)).toBe(false);
  });

  it('returns false before startDate', () => {
    const c = makeChallenge({ status: 'active', startDate: ACTIVE_START, endDate: ACTIVE_END });
    expect(c.isLive(NOW_BEFORE)).toBe(false);
  });

  it('returns false after endDate', () => {
    const c = makeChallenge({ status: 'active', startDate: ACTIVE_START, endDate: ACTIVE_END });
    expect(c.isLive(NOW_AFTER)).toBe(false);
  });
});

// ── Challenge — daysRemaining() ──────────────────────────────────────────────

describe('Challenge — daysRemaining()', () => {
  it('returns correct days remaining', () => {
    const NOW = new Date('2026-01-05T00:00:00Z');
    const END = new Date('2026-01-10T00:00:00Z');
    const c = makeChallenge({ endDate: END });
    expect(c.daysRemaining(NOW)).toBe(5);
  });

  it('returns 0 if end date has passed', () => {
    const NOW = new Date('2026-01-15T00:00:00Z');
    const END = new Date('2026-01-10T00:00:00Z');
    const c = makeChallenge({ endDate: END });
    expect(c.daysRemaining(NOW)).toBe(0);
  });
});

// ── Challenge — state transitions ────────────────────────────────────────────

describe('Challenge — activate()', () => {
  it('transitions upcoming → active', () => {
    const c2 = makeChallenge().activate(T1);
    expect(c2.status).toBe('active');
    expect(c2.updatedAt).toEqual(T1);
  });

  it('throws if not upcoming', () => {
    expect(() => makeChallenge({ status: 'active', startDate: T1, endDate: T10 }).activate(T1)).toThrow('Only upcoming challenges can be activated');
  });

  it('does not mutate original', () => {
    const c = makeChallenge();
    c.activate(T1);
    expect(c.status).toBe('upcoming');
  });
});

describe('Challenge — complete()', () => {
  it('transitions active → completed', () => {
    const c2 = makeChallenge({ status: 'active', startDate: T1, endDate: T10 }).complete(T10);
    expect(c2.status).toBe('completed');
  });

  it('throws if not active', () => {
    expect(() => makeChallenge().complete(T10)).toThrow('Only active challenges can be completed');
  });
});

describe('Challenge — cancel()', () => {
  it('transitions upcoming → cancelled', () => {
    const c2 = makeChallenge().cancel(T1);
    expect(c2.status).toBe('cancelled');
  });

  it('transitions active → cancelled', () => {
    const c2 = makeChallenge({ status: 'active', startDate: T1, endDate: T10 }).cancel(T1);
    expect(c2.status).toBe('cancelled');
  });

  it('throws if already completed', () => {
    const c = makeChallenge({ status: 'completed', startDate: T1, endDate: T10 });
    expect(() => c.cancel(T10)).toThrow('Cannot cancel a completed challenge');
  });
});

describe('Challenge — addParticipant()', () => {
  const LIVE_START = new Date('2026-01-01T00:00:00Z');
  const LIVE_END   = new Date('2026-12-31T00:00:00Z');
  const LIVE_NOW   = new Date('2026-06-15T00:00:00Z');

  it('increments participantCount when live', () => {
    const c2 = makeChallenge({ status: 'active', startDate: LIVE_START, endDate: LIVE_END }).addParticipant(LIVE_NOW);
    expect(c2.participantCount).toBe(1);
  });

  it('throws when not live', () => {
    expect(() => makeChallenge().addParticipant(LIVE_NOW)).toThrow('Cannot join a challenge that is not live');
  });
});

// ── ChallengeParticipation — constructor ─────────────────────────────────────

describe('ChallengeParticipation — constructor', () => {
  it('creates a valid participation record', () => {
    const p = makeParticipation();
    expect(p.challengeId).toBe('ch-1');
    expect(p.userId).toBe('u-1');
    expect(p.currentProgress).toBe(0);
  });

  it('throws if challengeId is empty', () => {
    expect(() => makeParticipation({ challengeId: '' })).toThrow('challengeId is required');
  });

  it('throws if userId is empty', () => {
    expect(() => makeParticipation({ userId: '' })).toThrow('userId is required');
  });

  it('throws if progress is negative', () => {
    expect(() => makeParticipation({ currentProgress: -1 })).toThrow('progress cannot be negative');
  });
});

// ── ChallengeParticipation — recordProgress() ────────────────────────────────

describe('ChallengeParticipation — recordProgress()', () => {
  it('updates progress', () => {
    const p2 = makeParticipation().recordProgress(5, 20, T1);
    expect(p2.currentProgress).toBe(5);
    expect(p2.completedAt).toBeUndefined();
  });

  it('sets completedAt when target is reached', () => {
    const p2 = makeParticipation().recordProgress(20, 20, T1);
    expect(p2.currentProgress).toBe(20);
    expect(p2.completedAt).toEqual(T1);
  });

  it('sets completedAt when target is exceeded', () => {
    const p2 = makeParticipation().recordProgress(25, 20, T1);
    expect(p2.completedAt).toEqual(T1);
  });

  it('does not regress progress below current', () => {
    const p2 = makeParticipation({ currentProgress: 10 }).recordProgress(3, 20, T1);
    expect(p2.currentProgress).toBe(10);
  });

  it('does not overwrite completedAt once set', () => {
    const p2 = makeParticipation({ currentProgress: 20, completedAt: T1 }).recordProgress(25, 20, T10);
    expect(p2.completedAt).toEqual(T1);
  });

  it('does not mutate original', () => {
    const original = makeParticipation();
    original.recordProgress(5, 20, T1);
    expect(original.currentProgress).toBe(0);
  });
});

// ── ChallengeParticipation — updateRank() ────────────────────────────────────

describe('ChallengeParticipation — updateRank()', () => {
  it('sets rank correctly', () => {
    const p2 = makeParticipation().updateRank(1, T1);
    expect(p2.rank).toBe(1);
    expect(p2.updatedAt).toEqual(T1);
  });

  it('throws if rank is 0', () => {
    expect(() => makeParticipation().updateRank(0, T1)).toThrow('rank must be >= 1');
  });

  it('throws if rank is negative', () => {
    expect(() => makeParticipation().updateRank(-3, T1)).toThrow('rank must be >= 1');
  });

  it('does not mutate original', () => {
    const p = makeParticipation();
    p.updateRank(1, T1);
    expect(p.rank).toBeUndefined();
  });
});
