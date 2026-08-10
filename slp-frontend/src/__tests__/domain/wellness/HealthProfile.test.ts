import { describe, it, expect } from '@jest/globals';
import { HealthProfile, type HealthProfileProps, type HealthCondition, type FitnessLevel } from '../../../domain/wellness/HealthProfile';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<HealthProfileProps>): HealthProfile {
  return new HealthProfile({
    id:              'hp-1',
    customerId:      'cust-1',
    conditions:      [],
    allergies:       [],
    injuries:        [],
    painAreas:       [],
    medications:     [],
    pregnancyMode:   false,
    seniorMode:      false,
    kidsMode:        false,
    fitnessLevel:    'moderate',
    doctorClearance: false,
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('HealthProfile — constructor', () => {
  it('creates valid profile with defaults', () => {
    const hp = make();
    expect(hp.id).toBe('hp-1');
    expect(hp.customerId).toBe('cust-1');
    expect(hp.pregnancyMode).toBe(false);
    expect(hp.seniorMode).toBe(false);
    expect(hp.kidsMode).toBe(false);
    expect(hp.fitnessLevel).toBe('moderate');
    expect(hp.doctorClearance).toBe(false);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when id is whitespace', () => {
    expect(() => make({ id: '   ' })).toThrow('id is required');
  });

  it('throws when customerId is empty', () => {
    expect(() => make({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when seniorMode and kidsMode both true', () => {
    expect(() => make({ seniorMode: true, kidsMode: true }))
      .toThrow('seniorMode and kidsMode cannot both be true');
  });

  it('throws when pregnancyMode true without pregnancyWeek', () => {
    expect(() => make({ pregnancyMode: true }))
      .toThrow('pregnancyMode requires pregnancyWeek');
  });

  it('throws when pregnancyWeek < 1', () => {
    expect(() => make({ pregnancyMode: true, pregnancyWeek: 0 }))
      .toThrow('pregnancyWeek must be 1-42');
  });

  it('throws when pregnancyWeek > 42', () => {
    expect(() => make({ pregnancyMode: true, pregnancyWeek: 43 }))
      .toThrow('pregnancyWeek must be 1-42');
  });

  it('accepts pregnancyWeek boundary values 1 and 42', () => {
    expect(() => make({ pregnancyMode: true, pregnancyWeek: 1  })).not.toThrow();
    expect(() => make({ pregnancyMode: true, pregnancyWeek: 42 })).not.toThrow();
  });

  it('throws when a painArea level is < 0', () => {
    expect(() => make({ painAreas: [{ area: 'knee', level: -1 }] }))
      .toThrow('pain level must be 0-10');
  });

  it('throws when a painArea level is > 10', () => {
    expect(() => make({ painAreas: [{ area: 'knee', level: 11 }] }))
      .toThrow('pain level must be 0-10');
  });

  it('accepts pain level 0 and 10 boundary values', () => {
    expect(() => make({ painAreas: [{ area: 'knee', level: 0 }] })).not.toThrow();
    expect(() => make({ painAreas: [{ area: 'neck', level: 10 }] })).not.toThrow();
  });
});

// ── Conditions ────────────────────────────────────────────────────────────────

describe('conditions', () => {
  it('addCondition appends condition', () => {
    const hp = make().addCondition('diabetes', LATER);
    expect(hp.conditions).toContain('diabetes');
    expect(hp.updatedAt).toEqual(LATER);
  });

  it('addCondition throws on duplicate', () => {
    const hp = make().addCondition('diabetes', NOW);
    expect(() => hp.addCondition('diabetes', LATER)).toThrow('"diabetes" already added');
  });

  it('removeCondition removes condition', () => {
    const hp = make().addCondition('diabetes', NOW).removeCondition('diabetes', LATER);
    expect(hp.conditions).not.toContain('diabetes');
  });

  it('removeCondition throws when not found', () => {
    expect(() => make().removeCondition('diabetes', NOW)).toThrow('"diabetes" not found');
  });

  const allConditions: HealthCondition[] = [
    'diabetes','hypertension','asthma','arthritis','heart_disease',
    'osteoporosis','anxiety','depression','migraine','chronic_pain',
  ];
  it.each(allConditions)('accepts condition type: %s', (cond) => {
    expect(() => make().addCondition(cond, NOW)).not.toThrow();
  });
});

// ── Allergies ─────────────────────────────────────────────────────────────────

describe('allergies', () => {
  it('addAllergy appends allergy', () => {
    const hp = make().addAllergy('latex', LATER);
    expect(hp.allergies).toContain('latex');
  });

  it('addAllergy throws on duplicate', () => {
    const hp = make().addAllergy('latex', NOW);
    expect(() => hp.addAllergy('latex', LATER)).toThrow('"latex" already added');
  });

  it('removeAllergy removes', () => {
    const hp = make().addAllergy('latex', NOW).removeAllergy('latex', LATER);
    expect(hp.allergies).toHaveLength(0);
  });

  it('removeAllergy throws when not found', () => {
    expect(() => make().removeAllergy('nuts', NOW)).toThrow('"nuts" not found');
  });
});

// ── Injuries ──────────────────────────────────────────────────────────────────

describe('injuries', () => {
  it('addInjury appends area', () => {
    const hp = make().addInjury('knee', LATER);
    expect(hp.injuries).toContain('knee');
  });

  it('addInjury throws on duplicate', () => {
    const hp = make().addInjury('knee', NOW);
    expect(() => hp.addInjury('knee', LATER)).toThrow('"knee" already added');
  });

  it('removeInjury removes', () => {
    const hp = make().addInjury('knee', NOW).removeInjury('knee', LATER);
    expect(hp.injuries).toHaveLength(0);
  });

  it('removeInjury throws when not found', () => {
    expect(() => make().removeInjury('hip', NOW)).toThrow('"hip" not found');
  });
});

// ── Pain Areas ────────────────────────────────────────────────────────────────

describe('painAreas', () => {
  it('addPainArea adds a new pain area', () => {
    const hp = make().addPainArea({ area: 'lower_back', level: 5 }, LATER);
    expect(hp.painAreas).toHaveLength(1);
    expect(hp.painAreas[0].area).toBe('lower_back');
    expect(hp.painAreas[0].level).toBe(5);
  });

  it('addPainArea throws on duplicate area', () => {
    const hp = make().addPainArea({ area: 'knee', level: 3 }, NOW);
    expect(() => hp.addPainArea({ area: 'knee', level: 5 }, LATER))
      .toThrow('"knee" already exists');
  });

  it('addPainArea throws on invalid level', () => {
    expect(() => make().addPainArea({ area: 'hip', level: 11 }, NOW))
      .toThrow('pain level must be 0-10');
  });

  it('updatePainLevel updates level', () => {
    const hp = make().addPainArea({ area: 'knee', level: 3 }, NOW);
    const updated = hp.updatePainLevel('knee', 7, LATER);
    expect(updated.painAreas[0].level).toBe(7);
    expect(updated.updatedAt).toEqual(LATER);
  });

  it('updatePainLevel throws when area not found', () => {
    expect(() => make().updatePainLevel('elbow', 5, NOW))
      .toThrow('"elbow" not found');
  });

  it('updatePainLevel throws on invalid level', () => {
    const hp = make().addPainArea({ area: 'knee', level: 3 }, NOW);
    expect(() => hp.updatePainLevel('knee', -1, LATER)).toThrow('pain level must be 0-10');
  });

  it('removePainArea removes', () => {
    const hp = make().addPainArea({ area: 'hip', level: 4 }, NOW).removePainArea('hip', LATER);
    expect(hp.painAreas).toHaveLength(0);
  });

  it('removePainArea throws when not found', () => {
    expect(() => make().removePainArea('shoulder', NOW)).toThrow('"shoulder" not found');
  });
});

// ── Medications ───────────────────────────────────────────────────────────────

describe('medications', () => {
  it('addMedication trims and appends', () => {
    const hp = make().addMedication('  Metformin  ', LATER);
    expect(hp.medications).toContain('Metformin');
  });

  it('addMedication throws on empty string', () => {
    expect(() => make().addMedication('', NOW)).toThrow('cannot be empty');
  });

  it('addMedication throws on whitespace', () => {
    expect(() => make().addMedication('   ', NOW)).toThrow('cannot be empty');
  });

  it('addMedication throws on duplicate', () => {
    const hp = make().addMedication('Aspirin', NOW);
    expect(() => hp.addMedication('Aspirin', LATER)).toThrow('"Aspirin" already added');
  });

  it('removeMedication removes', () => {
    const hp = make().addMedication('Aspirin', NOW).removeMedication('Aspirin', LATER);
    expect(hp.medications).toHaveLength(0);
  });

  it('removeMedication throws when not found', () => {
    expect(() => make().removeMedication('Aspirin', NOW)).toThrow('"Aspirin" not found');
  });
});

// ── Pregnancy Mode ────────────────────────────────────────────────────────────

describe('pregnancy mode', () => {
  it('setPregnancyMode sets flag and week', () => {
    const hp = make().setPregnancyMode(20, LATER);
    expect(hp.pregnancyMode).toBe(true);
    expect(hp.pregnancyWeek).toBe(20);
  });

  it('setPregnancyMode throws on week 0', () => {
    expect(() => make().setPregnancyMode(0, NOW)).toThrow('pregnancyWeek must be 1-42');
  });

  it('setPregnancyMode throws on week 43', () => {
    expect(() => make().setPregnancyMode(43, NOW)).toThrow('pregnancyWeek must be 1-42');
  });

  it('setPregnancyMode clears seniorMode and kidsMode', () => {
    const hp = make({ seniorMode: true }).setPregnancyMode(12, LATER);
    expect(hp.seniorMode).toBe(false);
  });

  it('clearPregnancyMode clears flag and week', () => {
    const hp = make().setPregnancyMode(10, NOW).clearPregnancyMode(LATER);
    expect(hp.pregnancyMode).toBe(false);
    expect(hp.pregnancyWeek).toBeUndefined();
  });
});

// ── Senior / Kids Mode ────────────────────────────────────────────────────────

describe('seniorMode / kidsMode', () => {
  it('setSeniorMode sets flag', () => {
    expect(make().setSeniorMode(LATER).seniorMode).toBe(true);
  });

  it('setSeniorMode throws when kidsMode is active', () => {
    expect(() => make({ kidsMode: true }).setSeniorMode(NOW))
      .toThrow('cannot set seniorMode when kidsMode is active');
  });

  it('setKidsMode sets flag', () => {
    expect(make().setKidsMode(LATER).kidsMode).toBe(true);
  });

  it('setKidsMode throws when seniorMode is active', () => {
    expect(() => make({ seniorMode: true }).setKidsMode(NOW))
      .toThrow('cannot set kidsMode when seniorMode is active');
  });
});

// ── Fitness Level ─────────────────────────────────────────────────────────────

describe('fitnessLevel', () => {
  const levels: FitnessLevel[] = ['sedentary','light','moderate','active','very_active'];
  it.each(levels)('setFitnessLevel accepts %s', (lvl) => {
    expect(make().setFitnessLevel(lvl, NOW).fitnessLevel).toBe(lvl);
  });
});

// ── Doctor Clearance ──────────────────────────────────────────────────────────

describe('doctorClearance', () => {
  it('grantDoctorClearance sets flag and notes', () => {
    const hp = make().grantDoctorClearance('Cleared for all styles', LATER);
    expect(hp.doctorClearance).toBe(true);
    expect(hp.doctorNotes).toBe('Cleared for all styles');
  });

  it('grantDoctorClearance works without notes', () => {
    expect(make().grantDoctorClearance(undefined, LATER).doctorClearance).toBe(true);
  });

  it('revokeDoctorClearance clears flag and notes', () => {
    const hp = make().grantDoctorClearance('OK', NOW).revokeDoctorClearance(LATER);
    expect(hp.doctorClearance).toBe(false);
    expect(hp.doctorNotes).toBeUndefined();
  });
});

// ── Defensive Copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('conditions getter returns a copy', () => {
    const hp = make({ conditions: ['diabetes'] });
    const arr = hp.conditions;
    (arr as string[]).push('asthma');
    expect(hp.conditions).toHaveLength(1);
  });

  it('allergies getter returns a copy', () => {
    const hp = make({ allergies: ['nuts'] });
    hp.allergies.push('gluten' as never);
    expect(hp.allergies).toHaveLength(1);
  });

  it('painAreas getter returns deep copy', () => {
    const hp = make({ painAreas: [{ area: 'knee', level: 3 }] });
    const arr = hp.painAreas;
    arr[0].level = 99;
    expect(hp.painAreas[0].level).toBe(3);
  });
});
