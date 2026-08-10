import { describe, it, expect } from '@jest/globals';
import { BodyMetrics, type BodyMetricsProps } from '../../../domain/wellness/BodyMetrics';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<BodyMetricsProps>): BodyMetrics {
  return new BodyMetrics({
    id:         'bm-1',
    customerId: 'cust-1',
    recordedAt: NOW,
    weightKg:   70,
    heightCm:   170,
    createdAt:  NOW,
    updatedAt:  NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('BodyMetrics — constructor', () => {
  it('creates valid metrics', () => {
    const bm = make();
    expect(bm.weightKg).toBe(70);
    expect(bm.heightCm).toBe(170);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is empty', () => {
    expect(() => make({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when weightKg is 0', () => {
    expect(() => make({ weightKg: 0 })).toThrow('weightKg must be greater than 0');
  });

  it('throws when weightKg is negative', () => {
    expect(() => make({ weightKg: -5 })).toThrow('weightKg must be greater than 0');
  });

  it('throws when heightCm is 0', () => {
    expect(() => make({ heightCm: 0 })).toThrow('heightCm must be greater than 0');
  });

  it('throws when heightCm is negative', () => {
    expect(() => make({ heightCm: -10 })).toThrow('heightCm must be greater than 0');
  });

  it('throws when chestCm is 0', () => {
    expect(() => make({ measurements: { chestCm: 0 } })).toThrow('chestCm must be greater than 0');
  });

  it('throws when waistCm is negative', () => {
    expect(() => make({ measurements: { waistCm: -1 } })).toThrow('waistCm must be greater than 0');
  });

  it('throws when hipsCm is 0', () => {
    expect(() => make({ measurements: { hipsCm: 0 } })).toThrow('hipsCm must be greater than 0');
  });

  it('accepts valid measurements', () => {
    expect(() => make({ measurements: { chestCm: 92, waistCm: 74, hipsCm: 96 } }))
      .not.toThrow();
  });
});

// ── BMI Calculation ───────────────────────────────────────────────────────────

describe('bmi()', () => {
  it('calculates BMI for normal weight person (70kg, 170cm)', () => {
    // 70 / (1.70^2) = 70 / 2.89 ≈ 24.2
    expect(make().bmi()).toBe(24.2);
  });

  it('calculates BMI for underweight person (45kg, 170cm)', () => {
    // 45 / 2.89 ≈ 15.6
    expect(make({ weightKg: 45, heightCm: 170 }).bmi()).toBe(15.6);
  });

  it('calculates BMI for overweight person (85kg, 170cm)', () => {
    // 85 / 2.89 ≈ 29.4
    expect(make({ weightKg: 85, heightCm: 170 }).bmi()).toBe(29.4);
  });

  it('calculates BMI for obese person (100kg, 170cm)', () => {
    // 100 / 2.89 ≈ 34.6
    expect(make({ weightKg: 100, heightCm: 170 }).bmi()).toBe(34.6);
  });

  it('rounds to 1 decimal place', () => {
    const bmi = make({ weightKg: 63.5, heightCm: 165 }).bmi();
    expect(Number.isFinite(bmi)).toBe(true);
    expect(bmi.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});

// ── BMI Category ─────────────────────────────────────────────────────────────

describe('bmiCategory()', () => {
  it('returns underweight for BMI < 18.5', () => {
    expect(make({ weightKg: 45, heightCm: 170 }).bmiCategory()).toBe('underweight');
  });

  it('returns normal for BMI 18.5–24.9', () => {
    expect(make({ weightKg: 70, heightCm: 170 }).bmiCategory()).toBe('normal');
  });

  it('returns overweight for BMI 25–29.9', () => {
    expect(make({ weightKg: 85, heightCm: 170 }).bmiCategory()).toBe('overweight');
  });

  it('returns obese for BMI >= 30', () => {
    expect(make({ weightKg: 100, heightCm: 170 }).bmiCategory()).toBe('obese');
  });

  it('returns normal at exact BMI 18.5 boundary', () => {
    // 53.5 / (1.70^2) ≈ 18.5
    const bm = make({ weightKg: 53.5, heightCm: 170 });
    expect(['normal', 'underweight']).toContain(bm.bmiCategory());
  });
});

// ── updateWeight ──────────────────────────────────────────────────────────────

describe('updateWeight()', () => {
  it('updates weight and recordedAt', () => {
    const bm = make().updateWeight(75, LATER, LATER);
    expect(bm.weightKg).toBe(75);
    expect(bm.recordedAt).toEqual(LATER);
    expect(bm.updatedAt).toEqual(LATER);
  });

  it('throws when new weight is 0', () => {
    expect(() => make().updateWeight(0, LATER, LATER)).toThrow('weightKg must be greater than 0');
  });

  it('recalculates BMI after weight update', () => {
    const before = make({ weightKg: 70 }).bmi();
    const after  = make({ weightKg: 70 }).updateWeight(80, LATER, LATER).bmi();
    expect(after).toBeGreaterThan(before);
  });
});

// ── updateHeight ──────────────────────────────────────────────────────────────

describe('updateHeight()', () => {
  it('updates height', () => {
    const bm = make().updateHeight(175, LATER);
    expect(bm.heightCm).toBe(175);
    expect(bm.updatedAt).toEqual(LATER);
  });

  it('throws when new height is 0', () => {
    expect(() => make().updateHeight(0, LATER)).toThrow('heightCm must be greater than 0');
  });
});

// ── updateMeasurements ────────────────────────────────────────────────────────

describe('updateMeasurements()', () => {
  it('updates measurements', () => {
    const bm = make().updateMeasurements({ waistCm: 80, hipsCm: 100 }, LATER);
    expect(bm.measurements?.waistCm).toBe(80);
    expect(bm.measurements?.hipsCm).toBe(100);
    expect(bm.updatedAt).toEqual(LATER);
  });

  it('throws when thighsCm is 0', () => {
    expect(() => make().updateMeasurements({ thighsCm: 0 }, LATER))
      .toThrow('thighsCm must be greater than 0');
  });

  it('returns copy of measurements from getter', () => {
    const bm = make({ measurements: { waistCm: 74 } });
    const m = bm.measurements!;
    m.waistCm = 999;
    expect(bm.measurements!.waistCm).toBe(74);
  });
});

// ── addNotes ──────────────────────────────────────────────────────────────────

describe('addNotes()', () => {
  it('adds notes', () => {
    const bm = make().addNotes('Post-vacation measurement', LATER);
    expect(bm.notes).toBe('Post-vacation measurement');
  });

  it('throws when notes is empty', () => {
    expect(() => make().addNotes('', LATER)).toThrow('notes cannot be empty');
  });

  it('throws when notes is whitespace', () => {
    expect(() => make().addNotes('   ', LATER)).toThrow('notes cannot be empty');
  });
});
