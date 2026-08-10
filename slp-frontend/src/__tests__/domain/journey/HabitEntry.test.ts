import { describe, it, expect } from '@jest/globals';
import { HabitEntry, type HabitEntryProps } from '../../../domain/journey/HabitEntry';

const NOW = new Date('2026-08-05T10:00:00Z');

function makeEntry(overrides: Partial<HabitEntryProps> = {}): HabitEntry {
  return new HabitEntry({
    id:          'he-1',
    customerId:  'cust-1',
    journeyId:   'jrn-1',
    habitType:   'morning_yoga',
    date:        '2026-08-05',
    completed:   false,
    targetValue: 30,
    createdAt:   NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('HabitEntry — construction', () => {
  it('creates a valid entry', () => {
    const e = makeEntry();
    expect(e.habitType).toBe('morning_yoga');
    expect(e.completed).toBe(false);
    expect(e.targetValue).toBe(30);
  });

  it('throws when id is missing', () => {
    expect(() => makeEntry({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is missing', () => {
    expect(() => makeEntry({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when journeyId is missing', () => {
    expect(() => makeEntry({ journeyId: '' })).toThrow('journeyId is required');
  });

  it('throws when date is missing', () => {
    expect(() => makeEntry({ date: '' })).toThrow('date is required');
  });

  it('throws when date has wrong format', () => {
    expect(() => makeEntry({ date: '05/08/2026' })).toThrow('YYYY-MM-DD');
    expect(() => makeEntry({ date: '2026-8-5' })).toThrow('YYYY-MM-DD');
  });

  it('accepts correct date format', () => {
    expect(() => makeEntry({ date: '2026-12-31' })).not.toThrow();
  });

  it('throws when targetValue < 1', () => {
    expect(() => makeEntry({ targetValue: 0 })).toThrow('at least 1');
  });

  it('throws when value < 0', () => {
    expect(() => makeEntry({ value: -1 })).toThrow('cannot be negative');
  });

  it('throws when completed but no completedAt', () => {
    expect(() => makeEntry({ completed: true })).toThrow('completedAt');
  });

  it('accepts completed with completedAt', () => {
    expect(() => makeEntry({ completed: true, completedAt: NOW })).not.toThrow();
  });

  it('stores unit and notes', () => {
    const e = makeEntry({ unit: 'minutes', notes: 'Felt great' });
    expect(e.unit).toBe('minutes');
    expect(e.notes).toBe('Felt great');
  });
});

// ── HabitType variety ─────────────────────────────────────────────────────────

describe('HabitType variety', () => {
  const types = ['morning_yoga','meditation','breathwork','journaling','water_intake','sleep_target','step_count','evening_yoga','gratitude','screen_free_hour'] as const;
  it.each(types)('accepts habitType %s', t => {
    expect(() => makeEntry({ habitType: t })).not.toThrow();
  });
});

// ── achievementPercent() ──────────────────────────────────────────────────────

describe('achievementPercent()', () => {
  it('returns 100 when completed and no value', () => {
    expect(makeEntry({ completed: true, completedAt: NOW }).achievementPercent()).toBe(100);
  });

  it('returns 0 when not completed and no value', () => {
    expect(makeEntry().achievementPercent()).toBe(0);
  });

  it('returns ratio when value set', () => {
    expect(makeEntry({ value: 15, targetValue: 30 }).achievementPercent()).toBe(50);
  });

  it('caps at 100 when value exceeds target', () => {
    expect(makeEntry({ value: 50, targetValue: 30 }).achievementPercent()).toBe(100);
  });
});

// ── meetsTarget() ─────────────────────────────────────────────────────────────

describe('meetsTarget()', () => {
  it('returns true when completed and no value', () => {
    expect(makeEntry({ completed: true, completedAt: NOW }).meetsTarget()).toBe(true);
  });

  it('returns false when not completed and no value', () => {
    expect(makeEntry().meetsTarget()).toBe(false);
  });

  it('returns true when value >= targetValue', () => {
    expect(makeEntry({ value: 30, targetValue: 30 }).meetsTarget()).toBe(true);
    expect(makeEntry({ value: 31, targetValue: 30 }).meetsTarget()).toBe(true);
  });

  it('returns false when value < targetValue', () => {
    expect(makeEntry({ value: 20, targetValue: 30 }).meetsTarget()).toBe(false);
  });
});

// ── complete() ────────────────────────────────────────────────────────────────

describe('complete()', () => {
  it('marks entry as completed', () => {
    const e = makeEntry().complete(NOW);
    expect(e.completed).toBe(true);
    expect(e.completedAt).toEqual(NOW);
  });

  it('throws when already completed', () => {
    expect(() => makeEntry({ completed: true, completedAt: NOW }).complete(NOW))
      .toThrow('already completed');
  });

  it('does not mutate original', () => {
    const e = makeEntry();
    e.complete(NOW);
    expect(e.completed).toBe(false);
  });
});

// ── uncomplete() ──────────────────────────────────────────────────────────────

describe('uncomplete()', () => {
  it('removes completed status', () => {
    const e = makeEntry({ completed: true, completedAt: NOW }).uncomplete();
    expect(e.completed).toBe(false);
    expect(e.completedAt).toBeUndefined();
  });

  it('throws when not completed', () => {
    expect(() => makeEntry().uncomplete()).toThrow('not completed');
  });
});

// ── setValue() ────────────────────────────────────────────────────────────────

describe('setValue()', () => {
  it('sets the value', () => {
    expect(makeEntry().setValue(2500).value).toBe(2500);
  });

  it('accepts 0', () => {
    expect(() => makeEntry().setValue(0)).not.toThrow();
  });

  it('throws when value < 0', () => {
    expect(() => makeEntry().setValue(-1)).toThrow('cannot be negative');
  });

  it('does not mutate original', () => {
    const e = makeEntry();
    e.setValue(100);
    expect(e.value).toBeUndefined();
  });
});

// ── addNotes() ────────────────────────────────────────────────────────────────

describe('addNotes()', () => {
  it('sets notes', () => {
    expect(makeEntry().addNotes('Morning sun salutations felt energising.').notes)
      .toBe('Morning sun salutations felt energising.');
  });
});
