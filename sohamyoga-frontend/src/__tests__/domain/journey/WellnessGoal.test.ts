import { describe, it, expect } from '@jest/globals';
import { WellnessGoal, type WellnessGoalProps } from '../../../domain/journey/WellnessGoal';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');
const FAR    = new Date('2027-06-01T00:00:00Z');

function makeGoal(overrides: Partial<WellnessGoalProps> = {}): WellnessGoal {
  return new WellnessGoal({
    id:          'goal-1',
    customerId:  'cust-1',
    journeyId:   'jrn-1',
    goalType:    'flexibility',
    description: 'Touch my toes within 3 months',
    progress:    30,
    status:      'active',
    createdAt:   NOW,
    updatedAt:   NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('WellnessGoal — construction', () => {
  it('creates a valid goal', () => {
    const g = makeGoal();
    expect(g.goalType).toBe('flexibility');
    expect(g.progress).toBe(30);
    expect(g.isActive()).toBe(true);
  });

  it('throws when id is missing', () => {
    expect(() => makeGoal({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is missing', () => {
    expect(() => makeGoal({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when journeyId is missing', () => {
    expect(() => makeGoal({ journeyId: '' })).toThrow('journeyId is required');
  });

  it('throws when description is missing', () => {
    expect(() => makeGoal({ description: '' })).toThrow('description is required');
  });

  it('throws when progress < 0', () => {
    expect(() => makeGoal({ progress: -1 })).toThrow('progress must be 0-100');
  });

  it('throws when progress > 100', () => {
    expect(() => makeGoal({ progress: 101 })).toThrow('progress must be 0-100');
  });

  it('accepts progress at boundaries', () => {
    expect(() => makeGoal({ progress: 0 })).not.toThrow();
    expect(() => makeGoal({ progress: 100, status: 'achieved', achievedAt: NOW })).not.toThrow();
  });

  it('throws when targetDate <= createdAt', () => {
    expect(() => makeGoal({ targetDate: NOW })).toThrow('after createdAt');
  });

  it('throws when achieved but no achievedAt', () => {
    expect(() => makeGoal({ status: 'achieved', progress: 100 })).toThrow('achievedAt');
  });

  it('throws when achieved but progress < 100', () => {
    expect(() => makeGoal({ status: 'achieved', progress: 99, achievedAt: NOW }))
      .toThrow('progress 100');
  });

  it('accepts achieved with progress 100 + achievedAt', () => {
    expect(() => makeGoal({ status: 'achieved', progress: 100, achievedAt: LATER })).not.toThrow();
  });
});

// ── GoalType variety ──────────────────────────────────────────────────────────

describe('GoalType variety', () => {
  const types = ['stress_relief','flexibility','strength','sleep','weight_loss','mindfulness','injury_recovery','spiritual','general_fitness'] as const;
  it.each(types)('accepts goalType %s', t => {
    expect(() => makeGoal({ goalType: t })).not.toThrow();
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isActive',    () => expect(makeGoal({ status: 'active'    }).isActive()).toBe(true));
  it('isAchieved',  () => expect(makeGoal({ status: 'achieved', progress: 100, achievedAt: NOW }).isAchieved()).toBe(true));
  it('isAbandoned', () => expect(makeGoal({ status: 'abandoned' }).isAbandoned()).toBe(true));
});

// ── updateProgress() ──────────────────────────────────────────────────────────

describe('updateProgress()', () => {
  it('updates progress', () => {
    expect(makeGoal().updateProgress(75, LATER).progress).toBe(75);
  });

  it('accepts 0 and 100', () => {
    expect(() => makeGoal().updateProgress(0, LATER)).not.toThrow();
    expect(() => makeGoal().updateProgress(100, LATER)).not.toThrow();
  });

  it('throws when progress < 0', () => {
    expect(() => makeGoal().updateProgress(-1, LATER)).toThrow('progress must be 0-100');
  });

  it('throws when progress > 100', () => {
    expect(() => makeGoal().updateProgress(101, LATER)).toThrow('progress must be 0-100');
  });

  it('throws when goal is not active', () => {
    expect(() => makeGoal({ status: 'abandoned' }).updateProgress(50, LATER))
      .toThrow('active goal');
  });

  it('does not mutate original', () => {
    const g = makeGoal({ progress: 30 });
    g.updateProgress(80, LATER);
    expect(g.progress).toBe(30);
  });
});

// ── achieve() ────────────────────────────────────────────────────────────────

describe('achieve()', () => {
  it('sets status to achieved and progress to 100', () => {
    const g = makeGoal({ progress: 90 }).achieve(LATER);
    expect(g.status).toBe('achieved');
    expect(g.progress).toBe(100);
    expect(g.achievedAt).toEqual(LATER);
  });

  it('throws when already achieved', () => {
    expect(() => makeGoal({ status: 'achieved', progress: 100, achievedAt: LATER }).achieve(NOW))
      .toThrow('already achieved');
  });

  it('throws when abandoned', () => {
    expect(() => makeGoal({ status: 'abandoned' }).achieve(LATER)).toThrow('cannot achieve an abandoned');
  });
});

// ── abandon() ────────────────────────────────────────────────────────────────

describe('abandon()', () => {
  it('abandons an active goal', () => {
    expect(makeGoal().abandon(LATER).status).toBe('abandoned');
  });

  it('throws when already abandoned', () => {
    expect(() => makeGoal({ status: 'abandoned' }).abandon(LATER)).toThrow('already abandoned');
  });

  it('throws when achieved', () => {
    expect(() => makeGoal({ status: 'achieved', progress: 100, achievedAt: NOW }).abandon(LATER))
      .toThrow('cannot abandon an achieved');
  });
});

// ── extendTargetDate() ────────────────────────────────────────────────────────

describe('extendTargetDate()', () => {
  it('extends the target date', () => {
    const g = makeGoal({ targetDate: FUTURE }).extendTargetDate(FAR, LATER);
    expect(g.targetDate).toEqual(FAR);
  });

  it('throws when new date is not later than current', () => {
    expect(() => makeGoal({ targetDate: FAR }).extendTargetDate(FUTURE, LATER))
      .toThrow('must be later than current');
  });

  it('throws when goal is not active', () => {
    expect(() => makeGoal({ status: 'abandoned' }).extendTargetDate(FAR, LATER))
      .toThrow('active goal');
  });

  it('throws when new date <= createdAt', () => {
    expect(() => makeGoal({ targetDate: FUTURE }).extendTargetDate(NOW, LATER))
      .toThrow('after createdAt');
  });
});

// ── updateDescription() ───────────────────────────────────────────────────────

describe('updateDescription()', () => {
  it('updates description', () => {
    expect(makeGoal().updateDescription('New goal.', LATER).description).toBe('New goal.');
  });

  it('throws on empty description', () => {
    expect(() => makeGoal().updateDescription('', LATER)).toThrow('cannot be empty');
  });
});
