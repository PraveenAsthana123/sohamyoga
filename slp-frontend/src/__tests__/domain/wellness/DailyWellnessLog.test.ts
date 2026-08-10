import { describe, it, expect } from '@jest/globals';
import { DailyWellnessLog, type DailyWellnessLogProps } from '../../../domain/wellness/DailyWellnessLog';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<DailyWellnessLogProps>): DailyWellnessLog {
  return new DailyWellnessLog({
    id:         'log-1',
    customerId: 'cust-1',
    date:       '2026-08-05',
    createdAt:  NOW,
    updatedAt:  NOW,
    ...overrides,
  });
}

// ── Constructor — required fields ─────────────────────────────────────────────

describe('DailyWellnessLog — constructor', () => {
  it('creates minimal log with no optional metrics', () => {
    const log = make();
    expect(log.id).toBe('log-1');
    expect(log.date).toBe('2026-08-05');
    expect(log.sleepHours).toBeUndefined();
    expect(log.mood).toBeUndefined();
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is empty', () => {
    expect(() => make({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when date format is invalid (wrong format)', () => {
    expect(() => make({ date: '05/08/2026' })).toThrow('YYYY-MM-DD format');
  });

  it('throws when date is just year', () => {
    expect(() => make({ date: '2026' })).toThrow('YYYY-MM-DD format');
  });

  it('throws when sleepHours < 0', () => {
    expect(() => make({ sleepHours: -1 })).toThrow('sleepHours must be 0-24');
  });

  it('throws when sleepHours > 24', () => {
    expect(() => make({ sleepHours: 25 })).toThrow('sleepHours must be 0-24');
  });

  it('accepts sleepHours boundary 0 and 24', () => {
    expect(() => make({ sleepHours: 0  })).not.toThrow();
    expect(() => make({ sleepHours: 24 })).not.toThrow();
  });

  it('throws when waterMl is negative', () => {
    expect(() => make({ waterMl: -100 })).toThrow('waterMl cannot be negative');
  });

  it('accepts waterMl of 0', () => {
    expect(() => make({ waterMl: 0 })).not.toThrow();
  });

  it('throws when calorieBurn is negative', () => {
    expect(() => make({ calorieBurn: -1 })).toThrow('calorieBurn cannot be negative');
  });

  it('throws when steps is negative', () => {
    expect(() => make({ steps: -1 })).toThrow('steps cannot be negative');
  });

  it('throws when heartRateBpm < 20', () => {
    expect(() => make({ heartRateBpm: 19 })).toThrow('heartRateBpm must be 20-250');
  });

  it('throws when heartRateBpm > 250', () => {
    expect(() => make({ heartRateBpm: 251 })).toThrow('heartRateBpm must be 20-250');
  });

  it('accepts heartRateBpm boundary 20 and 250', () => {
    expect(() => make({ heartRateBpm: 20  })).not.toThrow();
    expect(() => make({ heartRateBpm: 250 })).not.toThrow();
  });

  it('throws when mood < 1', () => {
    expect(() => make({ mood: 0 })).toThrow('mood must be 1-5');
  });

  it('throws when mood > 5', () => {
    expect(() => make({ mood: 6 })).toThrow('mood must be 1-5');
  });

  it('throws when energyLevel > 5', () => {
    expect(() => make({ energyLevel: 6 })).toThrow('energyLevel must be 1-5');
  });

  it('throws when stressLevel < 1', () => {
    expect(() => make({ stressLevel: 0 })).toThrow('stressLevel must be 1-10');
  });

  it('throws when stressLevel > 10', () => {
    expect(() => make({ stressLevel: 11 })).toThrow('stressLevel must be 1-10');
  });

  it('accepts stressLevel boundary 1 and 10', () => {
    expect(() => make({ stressLevel: 1  })).not.toThrow();
    expect(() => make({ stressLevel: 10 })).not.toThrow();
  });
});

// ── Logging methods ───────────────────────────────────────────────────────────

describe('logSleep()', () => {
  it('sets sleepHours', () => {
    const log = make().logSleep(7.5, LATER);
    expect(log.sleepHours).toBe(7.5);
    expect(log.updatedAt).toEqual(LATER);
  });

  it('accepts 0 hours sleep', () => {
    expect(make().logSleep(0, NOW).sleepHours).toBe(0);
  });

  it('throws on invalid hours', () => {
    expect(() => make().logSleep(25, NOW)).toThrow('sleepHours must be 0-24');
  });
});

describe('logWater()', () => {
  it('sets waterMl', () => {
    const log = make().logWater(2000, LATER);
    expect(log.waterMl).toBe(2000);
  });

  it('accepts 0 ml', () => {
    expect(make().logWater(0, NOW).waterMl).toBe(0);
  });

  it('throws on negative ml', () => {
    expect(() => make().logWater(-1, NOW)).toThrow('waterMl cannot be negative');
  });
});

describe('logCalories()', () => {
  it('sets calorieBurn', () => {
    expect(make().logCalories(350, LATER).calorieBurn).toBe(350);
  });

  it('throws on negative calories', () => {
    expect(() => make().logCalories(-10, NOW)).toThrow('calorieBurn cannot be negative');
  });
});

describe('logSteps()', () => {
  it('sets steps', () => {
    expect(make().logSteps(8500, LATER).steps).toBe(8500);
  });

  it('throws on negative steps', () => {
    expect(() => make().logSteps(-1, NOW)).toThrow('steps cannot be negative');
  });
});

describe('logHeartRate()', () => {
  it('sets heartRateBpm', () => {
    expect(make().logHeartRate(72, LATER).heartRateBpm).toBe(72);
  });

  it('throws when bpm < 20', () => {
    expect(() => make().logHeartRate(10, NOW)).toThrow('heartRateBpm must be 20-250');
  });

  it('throws when bpm > 250', () => {
    expect(() => make().logHeartRate(300, NOW)).toThrow('heartRateBpm must be 20-250');
  });
});

describe('logMood()', () => {
  it('sets mood 1-5', () => {
    expect(make().logMood(4, LATER).mood).toBe(4);
  });

  it('throws when mood is 0', () => {
    expect(() => make().logMood(0, NOW)).toThrow('mood must be 1-5');
  });

  it('throws when mood is 6', () => {
    expect(() => make().logMood(6, NOW)).toThrow('mood must be 1-5');
  });
});

describe('logEnergyLevel()', () => {
  it('sets energyLevel', () => {
    expect(make().logEnergyLevel(3, LATER).energyLevel).toBe(3);
  });

  it('throws on out-of-range', () => {
    expect(() => make().logEnergyLevel(0, NOW)).toThrow('energyLevel must be 1-5');
  });
});

describe('logStressLevel()', () => {
  it('sets stressLevel', () => {
    expect(make().logStressLevel(6, LATER).stressLevel).toBe(6);
  });

  it('throws when < 1', () => {
    expect(() => make().logStressLevel(0, NOW)).toThrow('stressLevel must be 1-10');
  });

  it('throws when > 10', () => {
    expect(() => make().logStressLevel(11, NOW)).toThrow('stressLevel must be 1-10');
  });
});

// ── wellnessScore() ───────────────────────────────────────────────────────────

describe('wellnessScore()', () => {
  it('returns undefined when no metrics logged', () => {
    expect(make().wellnessScore()).toBeUndefined();
  });

  it('computes score from mood only', () => {
    // mood=5 → 5/5*100 = 100
    expect(make().logMood(5, NOW).wellnessScore()).toBe(100);
  });

  it('computes score from mood=1 (lowest)', () => {
    // mood=1 → 1/5*100 = 20
    expect(make().logMood(1, NOW).wellnessScore()).toBe(20);
  });

  it('computes score from stress only (inverted)', () => {
    // stress=1 (best) → (11-1)/10*100 = 100
    expect(make().logStressLevel(1, NOW).wellnessScore()).toBe(100);
    // stress=10 (worst) → (11-10)/10*100 = 10
    expect(make().logStressLevel(10, NOW).wellnessScore()).toBe(10);
  });

  it('averages all three metrics', () => {
    const log = make()
      .logMood(5, NOW)           // 100
      .logEnergyLevel(5, NOW)    // 100
      .logStressLevel(1, NOW);   // 100
    expect(log.wellnessScore()).toBe(100);
  });

  it('computes mixed score', () => {
    const log = make()
      .logMood(3, NOW)           // 3/5*100 = 60
      .logEnergyLevel(3, NOW)    // 60
      .logStressLevel(5, NOW);   // (11-5)/10*100 = 60
    expect(log.wellnessScore()).toBe(60);
  });
});

// ── isComplete() ──────────────────────────────────────────────────────────────

describe('isComplete()', () => {
  it('returns false when no metrics logged', () => {
    expect(make().isComplete()).toBe(false);
  });

  it('returns false with partial metrics', () => {
    const log = make().logSleep(7, NOW).logMood(4, NOW);
    expect(log.isComplete()).toBe(false);
  });

  it('returns true when all key metrics logged', () => {
    const log = make()
      .logSleep(7, NOW)
      .logWater(2000, NOW)
      .logMood(4, NOW)
      .logEnergyLevel(4, NOW)
      .logStressLevel(3, NOW);
    expect(log.isComplete()).toBe(true);
  });
});

// ── addNotes ──────────────────────────────────────────────────────────────────

describe('addNotes()', () => {
  it('sets notes', () => {
    expect(make().addNotes('Felt great after yoga', LATER).notes).toBe('Felt great after yoga');
  });

  it('throws on empty notes', () => {
    expect(() => make().addNotes('', NOW)).toThrow('notes cannot be empty');
  });
});
