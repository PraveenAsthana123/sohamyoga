import { describe, it, expect } from '@jest/globals';
import { TeacherSchedule, type TeacherScheduleProps, type TimeSlot, type BlockedPeriod } from '../../../domain/teacher/TeacherSchedule';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

function make(overrides?: Partial<TeacherScheduleProps>): TeacherSchedule {
  return new TeacherSchedule({
    id:             'sched-1',
    teacherId:      'teacher-1',
    tenantId:       'tenant-1',
    status:         'draft',
    weeklySlots:    [],
    blockedPeriods: [],
    timezone:       'America/Toronto',
    effectiveFrom:  NOW,
    createdAt:      NOW,
    updatedAt:      NOW,
    ...overrides,
  });
}

const slot: TimeSlot = {
  dayOfWeek:   'monday',
  startTime:   '09:00',
  endTime:     '10:00',
  isRecurring: true,
};

const block: BlockedPeriod = {
  id:        'block-1',
  type:      'vacation',
  startDate: '2026-09-01',
  endDate:   '2026-09-07',
};

// ── Constructor ───────────────────────────────────────────────────────────────

describe('TeacherSchedule — constructor', () => {
  it('creates a draft schedule', () => {
    const s = make();
    expect(s.status).toBe('draft');
    expect(s.weeklySlots).toHaveLength(0);
    expect(s.blockedPeriods).toHaveLength(0);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when teacherId is empty', () => {
    expect(() => make({ teacherId: '' })).toThrow('teacherId is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when timezone is empty', () => {
    expect(() => make({ timezone: '' })).toThrow('timezone is required');
  });

  it('throws when effectiveTo is not after effectiveFrom', () => {
    expect(() => make({ effectiveTo: NOW })).toThrow('effectiveTo must be after effectiveFrom');
  });

  it('accepts effectiveTo in the future', () => {
    expect(() => make({ effectiveTo: FUTURE })).not.toThrow();
  });

  it('throws when a time slot has invalid startTime format', () => {
    expect(() => make({ weeklySlots: [{ ...slot, startTime: '9:00' }] }))
      .toThrow('startTime must be HH:MM format');
  });

  it('throws when endTime is not after startTime', () => {
    expect(() => make({ weeklySlots: [{ ...slot, endTime: '08:00' }] }))
      .toThrow('endTime must be after startTime');
  });

  it('throws when a blocked period has invalid date format', () => {
    expect(() => make({ blockedPeriods: [{ ...block, startDate: '01/09/2026' }] }))
      .toThrow('startDate must be YYYY-MM-DD format');
  });

  it('throws when blocked period endDate is before startDate', () => {
    expect(() => make({ blockedPeriods: [{ ...block, endDate: '2026-08-01' }] }))
      .toThrow('endDate must be on or after startDate');
  });

  it('accepts endDate equal to startDate', () => {
    expect(() => make({ blockedPeriods: [{ ...block, endDate: '2026-09-01' }] })).not.toThrow();
  });
});

// ── activate() / archive() ────────────────────────────────────────────────────

describe('activate() / archive()', () => {
  it('activates a draft schedule', () => {
    const s = make().activate(LATER);
    expect(s.status).toBe('active');
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws when activating non-draft', () => {
    expect(() => make().activate(NOW).activate(LATER))
      .toThrow('can only activate a draft schedule');
  });

  it('archives an active schedule', () => {
    const s = make().activate(NOW).archive(LATER);
    expect(s.status).toBe('archived');
  });

  it('throws when archiving non-active', () => {
    expect(() => make().archive(NOW)).toThrow('can only archive an active schedule');
  });
});

// ── addTimeSlot() ─────────────────────────────────────────────────────────────

describe('addTimeSlot()', () => {
  it('adds a time slot', () => {
    const s = make().addTimeSlot(slot, LATER);
    expect(s.weeklySlots).toHaveLength(1);
    expect(s.weeklySlots[0].dayOfWeek).toBe('monday');
    expect(s.weeklySlots[0].startTime).toBe('09:00');
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate day+startTime', () => {
    const s = make().addTimeSlot(slot, NOW);
    expect(() => s.addTimeSlot({ ...slot, endTime: '11:00' }, LATER))
      .toThrow('time slot monday 09:00 already exists');
  });

  it('allows same day with different startTime', () => {
    const s = make().addTimeSlot(slot, NOW)
      .addTimeSlot({ ...slot, startTime: '11:00', endTime: '12:00' }, LATER);
    expect(s.weeklySlots).toHaveLength(2);
  });

  it('throws on invalid time format', () => {
    expect(() => make().addTimeSlot({ ...slot, startTime: '9am' }, NOW))
      .toThrow('startTime must be HH:MM format');
  });

  it('throws when endTime <= startTime', () => {
    expect(() => make().addTimeSlot({ ...slot, endTime: '09:00' }, NOW))
      .toThrow('endTime must be after startTime');
  });
});

// ── removeTimeSlot() ──────────────────────────────────────────────────────────

describe('removeTimeSlot()', () => {
  it('removes a time slot', () => {
    const s = make().addTimeSlot(slot, NOW).removeTimeSlot('monday', '09:00', LATER);
    expect(s.weeklySlots).toHaveLength(0);
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws when slot not found', () => {
    expect(() => make().removeTimeSlot('tuesday', '09:00', NOW))
      .toThrow('time slot tuesday 09:00 not found');
  });
});

// ── addBlockedPeriod() ────────────────────────────────────────────────────────

describe('addBlockedPeriod()', () => {
  it('adds a blocked period', () => {
    const s = make().addBlockedPeriod(block, LATER);
    expect(s.blockedPeriods).toHaveLength(1);
    expect(s.blockedPeriods[0].id).toBe('block-1');
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate id', () => {
    const s = make().addBlockedPeriod(block, NOW);
    expect(() => s.addBlockedPeriod(block, LATER)).toThrow('"block-1" already exists');
  });

  it('throws on invalid date format', () => {
    expect(() => make().addBlockedPeriod({ ...block, id: 'b2', startDate: '01-09-2026' }, NOW))
      .toThrow('startDate must be YYYY-MM-DD format');
  });

  it('throws when endDate < startDate', () => {
    expect(() => make().addBlockedPeriod({ ...block, id: 'b2', endDate: '2026-08-31' }, NOW))
      .toThrow('endDate must be on or after startDate');
  });
});

// ── removeBlockedPeriod() ─────────────────────────────────────────────────────

describe('removeBlockedPeriod()', () => {
  it('removes a blocked period', () => {
    const s = make().addBlockedPeriod(block, NOW).removeBlockedPeriod('block-1', LATER);
    expect(s.blockedPeriods).toHaveLength(0);
  });

  it('throws when not found', () => {
    expect(() => make().removeBlockedPeriod('nonexistent', NOW))
      .toThrow('"nonexistent" not found');
  });
});

// ── isBlockedOnDate() ─────────────────────────────────────────────────────────

describe('isBlockedOnDate()', () => {
  it('returns false when no blocked periods', () => {
    expect(make().isBlockedOnDate('2026-09-04')).toBe(false);
  });

  it('returns true for a date within blocked period', () => {
    const s = make().addBlockedPeriod(block, NOW);
    expect(s.isBlockedOnDate('2026-09-01')).toBe(true);  // start
    expect(s.isBlockedOnDate('2026-09-04')).toBe(true);  // middle
    expect(s.isBlockedOnDate('2026-09-07')).toBe(true);  // end
  });

  it('returns false for a date outside blocked period', () => {
    const s = make().addBlockedPeriod(block, NOW);
    expect(s.isBlockedOnDate('2026-08-31')).toBe(false); // day before
    expect(s.isBlockedOnDate('2026-09-08')).toBe(false); // day after
  });

  it('throws on invalid date format', () => {
    expect(() => make().isBlockedOnDate('09/04/2026')).toThrow('date must be YYYY-MM-DD format');
  });
});

// ── setEffectiveTo() ──────────────────────────────────────────────────────────

describe('setEffectiveTo()', () => {
  it('sets effectiveTo to a future date', () => {
    const s = make().setEffectiveTo(FUTURE, LATER);
    expect(s.effectiveTo).toEqual(FUTURE);
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws when effectiveTo is not after effectiveFrom', () => {
    expect(() => make().setEffectiveTo(NOW, LATER))
      .toThrow('effectiveTo must be after effectiveFrom');
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('weeklySlots getter returns copy', () => {
    const s = make().addTimeSlot(slot, NOW);
    const slots = s.weeklySlots;
    slots.push({ ...slot, dayOfWeek: 'friday' });
    expect(s.weeklySlots).toHaveLength(1);
  });

  it('blockedPeriods getter returns copy', () => {
    const s = make().addBlockedPeriod(block, NOW);
    const periods = s.blockedPeriods;
    periods[0].reason = 'mutated';
    expect(s.blockedPeriods[0].reason).toBeUndefined();
  });

  it('all DayOfWeek values accepted', () => {
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
    for (const day of days) {
      expect(() => make().addTimeSlot({ ...slot, dayOfWeek: day }, NOW)).not.toThrow();
    }
  });
});
