import { describe, it, expect } from '@jest/globals';
import { CorporateWellnessProgram, type CorporateWellnessProgramProps } from '../../../domain/enterprise/CorporateWellnessProgram';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');
const START = new Date('2026-01-01T00:00:00Z');
const END   = new Date('2027-01-01T00:00:00Z');

function make(overrides?: Partial<CorporateWellnessProgramProps>): CorporateWellnessProgram {
  return new CorporateWellnessProgram({
    id:               'cwp-1',
    tenantId:         'tenant-1',
    corporateName:    'Acme Corp',
    contactName:      'Jane Smith',
    contactEmail:     'jane@acme.com',
    programName:      'Acme Wellness 2026',
    employeeCount:    0,
    maxEmployees:     100,
    pricePerEmployee: 5000, // $50/month in cents
    currency:         'CAD',
    startDate:        START,
    endDate:          END,
    status:           'draft',
    features:         [],
    createdAt:        NOW,
    updatedAt:        NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('CorporateWellnessProgram — constructor', () => {
  it('creates a draft program', () => {
    const p = make();
    expect(p.status).toBe('draft');
    expect(p.isDraft()).toBe(true);
    expect(p.employeeCount).toBe(0);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when corporateName is empty', () => {
    expect(() => make({ corporateName: '' })).toThrow('corporateName is required');
  });

  it('throws when contactName is empty', () => {
    expect(() => make({ contactName: '' })).toThrow('contactName is required');
  });

  it('throws when contactEmail is invalid', () => {
    expect(() => make({ contactEmail: 'not-an-email' })).toThrow('contactEmail is invalid');
    expect(() => make({ contactEmail: 'no@' })).toThrow('contactEmail is invalid');
  });

  it('throws when programName is empty', () => {
    expect(() => make({ programName: '' })).toThrow('programName is required');
  });

  it('throws when maxEmployees is 0', () => {
    expect(() => make({ maxEmployees: 0 })).toThrow('maxEmployees must be a positive integer');
  });

  it('throws when employeeCount is negative', () => {
    expect(() => make({ employeeCount: -1 })).toThrow('employeeCount must be a non-negative integer');
  });

  it('throws when employeeCount exceeds maxEmployees', () => {
    expect(() => make({ employeeCount: 101, maxEmployees: 100 })).toThrow('cannot exceed maxEmployees');
  });

  it('throws when pricePerEmployee is negative', () => {
    expect(() => make({ pricePerEmployee: -1 })).toThrow('pricePerEmployee must be a non-negative integer');
  });

  it('throws when currency is invalid', () => {
    expect(() => make({ currency: 'usd' })).toThrow('3-letter ISO 4217');
  });

  it('throws when endDate is not after startDate', () => {
    expect(() => make({ endDate: START })).toThrow('endDate must be after startDate');
  });

  it('accepts zero pricePerEmployee (free program)', () => {
    expect(() => make({ pricePerEmployee: 0 })).not.toThrow();
  });
});

// ── State machine ─────────────────────────────────────────────────────────────

describe('lifecycle state machine', () => {
  it('draft → active', () => {
    const p = make().activate(LATER);
    expect(p.status).toBe('active');
    expect(p.isActive()).toBe(true);
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws activating non-draft', () => {
    expect(() => make({ status: 'active' }).activate(LATER)).toThrow('can only activate a draft');
  });

  it('active → paused', () => {
    const p = make().activate(NOW).pause(LATER);
    expect(p.status).toBe('paused');
    expect(p.isPaused()).toBe(true);
  });

  it('throws pausing non-active', () => {
    expect(() => make().pause(LATER)).toThrow('can only pause an active');
  });

  it('paused → active (resume)', () => {
    const p = make().activate(NOW).pause(NOW).resume(LATER);
    expect(p.status).toBe('active');
  });

  it('throws resuming non-paused', () => {
    expect(() => make().resume(LATER)).toThrow('can only resume a paused');
  });

  it('active → completed', () => {
    const p = make().activate(NOW).complete(LATER);
    expect(p.status).toBe('completed');
    expect(p.isCompleted()).toBe(true);
  });

  it('throws completing non-active', () => {
    expect(() => make().complete(LATER)).toThrow('can only complete an active');
  });

  it('draft → cancelled', () => {
    const p = make().cancel(LATER);
    expect(p.status).toBe('cancelled');
    expect(p.isCancelled()).toBe(true);
  });

  it('active → cancelled', () => {
    const p = make().activate(NOW).cancel(LATER);
    expect(p.status).toBe('cancelled');
  });

  it('paused → cancelled', () => {
    const p = make().activate(NOW).pause(NOW).cancel(LATER);
    expect(p.status).toBe('cancelled');
  });

  it('throws cancelling completed', () => {
    expect(() => make().activate(NOW).complete(NOW).cancel(LATER))
      .toThrow('cannot cancel a completed');
  });

  it('throws cancelling already cancelled', () => {
    expect(() => make().cancel(NOW).cancel(LATER)).toThrow('already cancelled');
  });
});

// ── enrollEmployee() / unenrollEmployee() ─────────────────────────────────────

describe('enrollEmployee() / unenrollEmployee()', () => {
  it('increments employeeCount', () => {
    const p = make().activate(NOW).enrollEmployee(LATER);
    expect(p.employeeCount).toBe(1);
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws enrolling in non-active', () => {
    expect(() => make().enrollEmployee(LATER)).toThrow('can only enroll employees in an active');
  });

  it('throws when at capacity', () => {
    const full = make({ employeeCount: 100, maxEmployees: 100, status: 'active' });
    expect(() => full.enrollEmployee(LATER)).toThrow('full capacity');
  });

  it('isAtCapacity() returns true when full', () => {
    const p = make({ employeeCount: 100, maxEmployees: 100 });
    expect(p.isAtCapacity()).toBe(true);
  });

  it('isAtCapacity() returns false when not full', () => {
    expect(make().isAtCapacity()).toBe(false);
  });

  it('unenroll from already-active', () => {
    const p = make({ employeeCount: 3, status: 'active' }).unenrollEmployee(LATER);
    expect(p.employeeCount).toBe(2);
  });

  it('throws when no employees to unenroll', () => {
    expect(() => make().unenrollEmployee(LATER)).toThrow('no employees to unenroll');
  });
});

// ── addFeature() / removeFeature() ───────────────────────────────────────────

describe('addFeature() / removeFeature()', () => {
  it('adds a feature', () => {
    const p = make().addFeature('yoga_classes', LATER);
    expect(p.features).toContain('yoga_classes');
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate feature', () => {
    const p = make({ features: ['yoga_classes'] });
    expect(() => p.addFeature('yoga_classes', LATER)).toThrow('already added');
  });

  it('throws when feature is empty', () => {
    expect(() => make().addFeature('', NOW)).toThrow('feature is required');
  });

  it('removes a feature', () => {
    const p = make({ features: ['yoga_classes', 'meditation'] }).removeFeature('meditation', LATER);
    expect(p.features).not.toContain('meditation');
    expect(p.features).toContain('yoga_classes');
  });

  it('throws when removing non-existent feature', () => {
    expect(() => make().removeFeature('nonexistent', NOW)).toThrow('feature not found');
  });
});

// ── totalMonthlyRevenue() / utilizationPercent() ──────────────────────────────

describe('calculations', () => {
  it('totalMonthlyRevenue = pricePerEmployee × employeeCount', () => {
    const p = make({ employeeCount: 20, pricePerEmployee: 5000 });
    expect(p.totalMonthlyRevenue()).toBe(100000);
  });

  it('totalMonthlyRevenue is 0 when no employees enrolled', () => {
    expect(make().totalMonthlyRevenue()).toBe(0);
  });

  it('utilizationPercent = employeeCount / maxEmployees × 100', () => {
    const p = make({ employeeCount: 50, maxEmployees: 100 });
    expect(p.utilizationPercent()).toBe(50);
  });

  it('utilizationPercent rounds to integer', () => {
    const p = make({ employeeCount: 1, maxEmployees: 3 });
    expect(Number.isInteger(p.utilizationPercent())).toBe(true);
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('features getter returns copy', () => {
    const p = make({ features: ['yoga_classes'] });
    p.features.push('mutated');
    expect(p.features).toHaveLength(1);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('activate does not mutate original', () => {
    const original = make();
    original.activate(LATER);
    expect(original.status).toBe('draft');
  });
});
