import { describe, it, expect } from '@jest/globals';
import { Pranayama, type PranayamaProps, type RatioStep } from '../../../domain/yoga/Pranayama';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');

const BOX: RatioStep[] = [
  { phase: 'inhale',   counts: 4 },
  { phase: 'hold_in',  counts: 4 },
  { phase: 'exhale',   counts: 4 },
  { phase: 'hold_out', counts: 4 },
];

function make(overrides?: Partial<PranayamaProps>): Pranayama {
  return new Pranayama({
    id:              'prana-1',
    tenantId:        'tenant-1',
    sanskritName:    'Sama Vritti',
    englishName:     'Box Breathing',
    pattern:         'box',
    ratioSteps:      BOX,
    rounds:          5,
    durationMinutes: 5,
    benefits:        [],
    contraindications: [],
    doshaBalance:    [],
    difficultyLevel: 'beginner',
    isActive:        true,
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('Pranayama — constructor', () => {
  it('creates valid pranayama', () => {
    const p = make();
    expect(p.id).toBe('prana-1');
    expect(p.rounds).toBe(5);
    expect(p.totalRatioCounts()).toBe(16);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when sanskritName is empty', () => {
    expect(() => make({ sanskritName: '' })).toThrow('sanskritName is required');
  });

  it('throws when englishName is empty', () => {
    expect(() => make({ englishName: '' })).toThrow('englishName is required');
  });

  it('throws when rounds < 1', () => {
    expect(() => make({ rounds: 0 })).toThrow('rounds must be at least 1');
  });

  it('throws when durationMinutes < 1', () => {
    expect(() => make({ durationMinutes: 0 })).toThrow('durationMinutes must be at least 1');
  });

  it('throws when ratioSteps has fewer than 2 steps', () => {
    expect(() => make({ ratioSteps: [{ phase: 'inhale', counts: 4 }] }))
      .toThrow('ratioSteps must have at least 2 steps');
  });

  it('throws when ratioSteps has no inhale', () => {
    expect(() => make({ ratioSteps: [{ phase: 'exhale', counts: 4 }, { phase: 'hold_out', counts: 4 }] }))
      .toThrow('must include an inhale phase');
  });

  it('throws when ratioSteps has no exhale', () => {
    expect(() => make({ ratioSteps: [{ phase: 'inhale', counts: 4 }, { phase: 'hold_in', counts: 4 }] }))
      .toThrow('must include an exhale phase');
  });

  it('throws when a step has count < 1', () => {
    const steps: RatioStep[] = [{ phase: 'inhale', counts: 0 }, { phase: 'exhale', counts: 4 }];
    expect(() => make({ ratioSteps: steps })).toThrow('counts must be a positive integer');
  });

  it('throws when a step has non-integer count', () => {
    const steps: RatioStep[] = [{ phase: 'inhale', counts: 1.5 }, { phase: 'exhale', counts: 4 }];
    expect(() => make({ ratioSteps: steps })).toThrow('counts must be a positive integer');
  });
});

// ── All patterns accepted ─────────────────────────────────────────────────────

describe('patterns', () => {
  const patterns = ['box','ratio','alternate_nostril','bellows','cooling','humming','ocean','skull_shining'] as const;
  it.each(patterns)('accepts pattern: %s', (pattern) => {
    expect(() => make({ pattern })).not.toThrow();
  });
});

// ── addBenefit / removeBenefit ────────────────────────────────────────────────

describe('addBenefit() / removeBenefit()', () => {
  it('adds a benefit', () => {
    const p = make().addBenefit('Reduces anxiety', LATER);
    expect(p.benefits).toContain('Reduces anxiety');
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate benefit', () => {
    const p = make().addBenefit('Reduces anxiety', NOW);
    expect(() => p.addBenefit('Reduces anxiety', LATER)).toThrow('already added');
  });

  it('throws when benefit is empty', () => {
    expect(() => make().addBenefit('', NOW)).toThrow('benefit is required');
  });

  it('removes a benefit', () => {
    const p = make().addBenefit('Reduces anxiety', NOW).removeBenefit('Reduces anxiety', LATER);
    expect(p.benefits).not.toContain('Reduces anxiety');
  });

  it('throws when removing non-existent benefit', () => {
    expect(() => make().removeBenefit('nonexistent', NOW)).toThrow('not found');
  });
});

// ── addContraindication / removeContraindication ──────────────────────────────

describe('addContraindication() / removeContraindication()', () => {
  it('adds a contraindication', () => {
    const p = make().addContraindication('Asthma', NOW);
    expect(p.contraindications).toContain('Asthma');
  });

  it('throws on duplicate', () => {
    const p = make().addContraindication('Asthma', NOW);
    expect(() => p.addContraindication('Asthma', LATER)).toThrow('already added');
  });

  it('throws when empty', () => {
    expect(() => make().addContraindication('', NOW)).toThrow('condition is required');
  });

  it('removes a contraindication', () => {
    const p = make().addContraindication('Asthma', NOW).removeContraindication('Asthma', LATER);
    expect(p.contraindications).toHaveLength(0);
  });

  it('throws when removing non-existent', () => {
    expect(() => make().removeContraindication('nonexistent', NOW)).toThrow('not found');
  });
});

// ── setRounds / setDuration ───────────────────────────────────────────────────

describe('setRounds() / setDuration()', () => {
  it('sets rounds', () => {
    expect(make().setRounds(10, NOW).rounds).toBe(10);
  });

  it('throws when rounds < 1', () => {
    expect(() => make().setRounds(0, NOW)).toThrow('rounds must be at least 1');
  });

  it('sets duration', () => {
    expect(make().setDuration(15, NOW).durationMinutes).toBe(15);
  });

  it('throws when duration < 1', () => {
    expect(() => make().setDuration(0, NOW)).toThrow('durationMinutes must be at least 1');
  });
});

// ── totalRatioCounts / cycleDescription ───────────────────────────────────────

describe('computed helpers', () => {
  it('totalRatioCounts sums all step counts', () => {
    expect(make().totalRatioCounts()).toBe(16); // 4+4+4+4
  });

  it('totalRatioCounts works for simple 2-step', () => {
    const p = make({ ratioSteps: [{ phase: 'inhale', counts: 5 }, { phase: 'exhale', counts: 5 }] });
    expect(p.totalRatioCounts()).toBe(10);
  });

  it('cycleDescription returns phase:count pairs', () => {
    const desc = make().cycleDescription();
    expect(desc).toContain('inhale:4');
    expect(desc).toContain('exhale:4');
  });
});

// ── activate / deactivate ─────────────────────────────────────────────────────

describe('activate() / deactivate()', () => {
  it('deactivates an active pranayama', () => {
    expect(make().deactivate(NOW).isActive).toBe(false);
  });

  it('throws when deactivating already inactive', () => {
    expect(() => make({ isActive: false }).deactivate(NOW)).toThrow('already inactive');
  });

  it('activates an inactive pranayama', () => {
    expect(make({ isActive: false }).activate(NOW).isActive).toBe(true);
  });

  it('throws when activating already active', () => {
    expect(() => make().activate(NOW)).toThrow('already active');
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('ratioSteps getter returns copy', () => {
    const p = make();
    const steps = p.ratioSteps;
    steps[0].counts = 999;
    expect(p.ratioSteps[0].counts).toBe(4);
  });

  it('benefits getter returns copy', () => {
    const p = make().addBenefit('Focus', NOW);
    p.benefits.push('mutated');
    expect(p.benefits).toHaveLength(1);
  });

  it('constructor makes defensive copy of ratioSteps', () => {
    const steps: RatioStep[] = [{ phase: 'inhale', counts: 4 }, { phase: 'exhale', counts: 4 }];
    const p = make({ ratioSteps: steps });
    steps[0].counts = 999;
    expect(p.ratioSteps[0].counts).toBe(4);
  });
});
