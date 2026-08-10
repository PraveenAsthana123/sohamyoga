import { describe, it, expect } from '@jest/globals';
import { CustomerJourney, type JourneyProps } from '../../../domain/journey/CustomerJourney';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const BEFORE = new Date('2026-08-04T10:00:00Z');

function makeJourney(overrides: Partial<JourneyProps> = {}): CustomerJourney {
  return new CustomerJourney({
    id:                  'jrn-1',
    customerId:          'cust-1',
    currentPhase:        'beginner',
    status:              'in_progress',
    stylePreferences:    ['hatha'],
    practiceGoals:       ['stress_relief'],
    weeklyTargetMinutes: 120,
    currentStreakDays:   3,
    longestStreakDays:   7,
    totalSessionCount:   10,
    totalMinutes:        600,
    milestoneIds:        [],
    joinedAt:            BEFORE,
    updatedAt:           NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('CustomerJourney — construction', () => {
  it('creates a valid journey', () => {
    const j = makeJourney();
    expect(j.id).toBe('jrn-1');
    expect(j.currentPhase).toBe('beginner');
    expect(j.isInProgress()).toBe(true);
  });

  it('throws when id is missing', () => {
    expect(() => makeJourney({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is missing', () => {
    expect(() => makeJourney({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when weeklyTargetMinutes < 1', () => {
    expect(() => makeJourney({ weeklyTargetMinutes: 0 })).toThrow('at least 1');
  });

  it('throws when currentStreakDays < 0', () => {
    expect(() => makeJourney({ currentStreakDays: -1 })).toThrow('cannot be negative');
  });

  it('throws when totalSessionCount < 0', () => {
    expect(() => makeJourney({ totalSessionCount: -1 })).toThrow('cannot be negative');
  });

  it('throws when currentStreak > longestStreak', () => {
    expect(() => makeJourney({ currentStreakDays: 10, longestStreakDays: 5 }))
      .toThrow('cannot exceed longestStreakDays');
  });

  it('throws when lastPracticeAt < joinedAt', () => {
    const tooEarly = new Date(BEFORE.getTime() - 1000);
    expect(() => makeJourney({ lastPracticeAt: tooEarly }))
      .toThrow('cannot be before joinedAt');
  });

  it('throws when completed but not ambassador phase', () => {
    expect(() => makeJourney({ status: 'completed', currentPhase: 'beginner' }))
      .toThrow('ambassador phase');
  });

  it('accepts completed + ambassador together', () => {
    expect(() => makeJourney({ status: 'completed', currentPhase: 'ambassador' })).not.toThrow();
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isNew',         () => expect(makeJourney({ status: 'new',         currentPhase: 'onboarding' }).isNew()).toBe(true));
  it('isInProgress',  () => expect(makeJourney({ status: 'in_progress' }).isInProgress()).toBe(true));
  it('isPaused',      () => expect(makeJourney({ status: 'paused'      }).isPaused()).toBe(true));
  it('isCompleted',   () => expect(makeJourney({ status: 'completed', currentPhase: 'ambassador' }).isCompleted()).toBe(true));
  it('isOnboarding',  () => expect(makeJourney({ currentPhase: 'onboarding', status: 'new' }).isOnboarding()).toBe(true));
  it('isAmbassador',  () => expect(makeJourney({ currentPhase: 'ambassador', status: 'in_progress' }).isAmbassador()).toBe(true));
});

describe('phaseIndex()', () => {
  it('returns 0 for onboarding', () => {
    expect(makeJourney({ currentPhase: 'onboarding', status: 'new' }).phaseIndex()).toBe(0);
  });
  it('returns 4 for ambassador', () => {
    expect(makeJourney({ currentPhase: 'ambassador', status: 'in_progress' }).phaseIndex()).toBe(4);
  });
});

// ── start() ───────────────────────────────────────────────────────────────────

describe('start()', () => {
  it('starts a new journey', () => {
    const j = makeJourney({ status: 'new', currentPhase: 'onboarding' }).start(LATER);
    expect(j.status).toBe('in_progress');
    expect(j.currentPhase).toBe('beginner');
  });

  it('throws when already started', () => {
    expect(() => makeJourney({ status: 'in_progress' }).start(LATER)).toThrow('already started');
  });

  it('does not mutate original', () => {
    const j = makeJourney({ status: 'new', currentPhase: 'onboarding' });
    j.start(LATER);
    expect(j.isNew()).toBe(true);
  });
});

// ── pause() / resume() ────────────────────────────────────────────────────────

describe('pause()', () => {
  it('pauses an in-progress journey', () => {
    expect(makeJourney().pause(LATER).status).toBe('paused');
  });

  it('throws when not in progress', () => {
    expect(() => makeJourney({ status: 'paused' }).pause(LATER))
      .toThrow('can only pause an in-progress');
  });
});

describe('resume()', () => {
  it('resumes a paused journey', () => {
    expect(makeJourney({ status: 'paused' }).resume(LATER).status).toBe('in_progress');
  });

  it('throws when not paused', () => {
    expect(() => makeJourney({ status: 'in_progress' }).resume(LATER)).toThrow('can only resume a paused');
  });
});

// ── complete() ────────────────────────────────────────────────────────────────

describe('complete()', () => {
  it('completes an ambassador journey', () => {
    expect(makeJourney({ currentPhase: 'ambassador' }).complete(LATER).status).toBe('completed');
  });

  it('throws when not ambassador', () => {
    expect(() => makeJourney({ currentPhase: 'beginner' }).complete(LATER))
      .toThrow('ambassador phase');
  });

  it('throws when already completed', () => {
    expect(() => makeJourney({ status: 'completed', currentPhase: 'ambassador' }).complete(LATER))
      .toThrow('already completed');
  });
});

// ── advance() ─────────────────────────────────────────────────────────────────

describe('advance()', () => {
  const phases = ['onboarding', 'beginner', 'intermediate', 'advanced'] as const;

  it.each(phases)('advances from %s', phase => {
    const j = makeJourney({ currentPhase: phase, status: 'in_progress' }).advance(LATER);
    const phaseOrder = ['onboarding', 'beginner', 'intermediate', 'advanced', 'ambassador'];
    const nextPhase = phaseOrder[phaseOrder.indexOf(phase) + 1];
    expect(j.currentPhase).toBe(nextPhase);
  });

  it('throws when already ambassador', () => {
    expect(() => makeJourney({ currentPhase: 'ambassador' }).advance(LATER))
      .toThrow('highest phase');
  });
});

// ── recordSession() ───────────────────────────────────────────────────────────

describe('recordSession()', () => {
  it('increments session count and minutes', () => {
    const j = makeJourney({ totalSessionCount: 10, totalMinutes: 600 })
      .recordSession(60, NOW, LATER);
    expect(j.totalSessionCount).toBe(11);
    expect(j.totalMinutes).toBe(660);
    expect(j.lastPracticeAt).toEqual(NOW);
  });

  it('throws when durationMinutes < 1', () => {
    expect(() => makeJourney().recordSession(0, NOW, LATER)).toThrow('at least 1');
  });

  it('throws when journey is paused', () => {
    expect(() => makeJourney({ status: 'paused' }).recordSession(30, NOW, LATER))
      .toThrow('in-progress journey');
  });

  it('throws when practiceAt before joinedAt', () => {
    const veryEarly = new Date(BEFORE.getTime() - 1000);
    expect(() => makeJourney().recordSession(30, veryEarly, LATER))
      .toThrow('before joinedAt');
  });

  it('does not mutate original', () => {
    const j = makeJourney();
    j.recordSession(30, NOW, LATER);
    expect(j.totalSessionCount).toBe(10);
  });
});

// ── Streak management ─────────────────────────────────────────────────────────

describe('incrementStreak()', () => {
  it('increments currentStreakDays', () => {
    const j = makeJourney({ currentStreakDays: 7, longestStreakDays: 14 }).incrementStreak(LATER);
    expect(j.currentStreakDays).toBe(8);
    expect(j.longestStreakDays).toBe(14);
  });

  it('updates longestStreakDays when streak exceeds it', () => {
    const j = makeJourney({ currentStreakDays: 14, longestStreakDays: 14 }).incrementStreak(LATER);
    expect(j.longestStreakDays).toBe(15);
    expect(j.currentStreakDays).toBe(15);
  });
});

describe('resetStreak()', () => {
  it('resets currentStreakDays to 0 but keeps longestStreak', () => {
    const j = makeJourney({ currentStreakDays: 7, longestStreakDays: 30 }).resetStreak(LATER);
    expect(j.currentStreakDays).toBe(0);
    expect(j.longestStreakDays).toBe(30);
  });
});

// ── setWeeklyTarget() ─────────────────────────────────────────────────────────

describe('setWeeklyTarget()', () => {
  it('updates target', () => {
    expect(makeJourney().setWeeklyTarget(180, LATER).weeklyTargetMinutes).toBe(180);
  });

  it('throws when < 1', () => {
    expect(() => makeJourney().setWeeklyTarget(0, LATER)).toThrow('at least 1');
  });
});

// ── Style preferences ─────────────────────────────────────────────────────────

describe('addStylePreference() / removeStylePreference()', () => {
  it('adds a style', () => {
    const j = makeJourney({ stylePreferences: [] }).addStylePreference('vinyasa', LATER);
    expect(j.stylePreferences).toContain('vinyasa');
  });

  it('throws on duplicate style', () => {
    expect(() => makeJourney({ stylePreferences: ['hatha'] }).addStylePreference('hatha', LATER))
      .toThrow('"hatha" already added');
  });

  it('removes a style', () => {
    const j = makeJourney({ stylePreferences: ['hatha', 'yin'] }).removeStylePreference('hatha', LATER);
    expect(j.stylePreferences).not.toContain('hatha');
    expect(j.stylePreferences).toContain('yin');
  });

  it('throws when style not found', () => {
    expect(() => makeJourney().removeStylePreference('ashtanga', LATER)).toThrow('not found');
  });

  it('stylePreferences is a defensive copy', () => {
    const j = makeJourney({ stylePreferences: ['hatha'] });
    j.stylePreferences.push('spy' as never);
    expect(j.stylePreferences).toEqual(['hatha']);
  });
});

// ── Practice goals ────────────────────────────────────────────────────────────

describe('addGoal() / removeGoal()', () => {
  it('adds a goal', () => {
    const j = makeJourney().addGoal('flexibility', LATER);
    expect(j.practiceGoals).toContain('flexibility');
  });

  it('throws on duplicate goal', () => {
    expect(() => makeJourney({ practiceGoals: ['stress_relief'] }).addGoal('stress_relief', LATER))
      .toThrow('already added');
  });

  it('removes a goal', () => {
    const j = makeJourney({ practiceGoals: ['stress_relief', 'flexibility'] })
      .removeGoal('stress_relief', LATER);
    expect(j.practiceGoals).not.toContain('stress_relief');
  });

  it('throws when goal not found', () => {
    expect(() => makeJourney().removeGoal('strength', LATER)).toThrow('not found');
  });
});

// ── Milestones ────────────────────────────────────────────────────────────────

describe('addMilestone()', () => {
  it('adds a milestone id', () => {
    expect(makeJourney().addMilestone('ms-1', LATER).milestoneIds).toContain('ms-1');
  });

  it('throws on empty milestoneId', () => {
    expect(() => makeJourney().addMilestone('', LATER)).toThrow('cannot be empty');
  });

  it('throws on duplicate', () => {
    const j = makeJourney().addMilestone('ms-1', LATER);
    expect(() => j.addMilestone('ms-1', LATER)).toThrow('already recorded');
  });

  it('milestoneIds is a defensive copy', () => {
    const j = makeJourney().addMilestone('ms-1', LATER);
    j.milestoneIds.push('spy');
    expect(j.milestoneIds).toEqual(['ms-1']);
  });
});
