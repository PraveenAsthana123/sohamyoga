import { describe, it, expect } from '@jest/globals';
import { Branch, type BranchProps, type BranchType } from '../../../domain/enterprise/Branch';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<BranchProps>): Branch {
  return new Branch({
    id:           'branch-1',
    tenantId:     'tenant-1',
    name:         'Downtown Studio',
    type:         'corporate_owned',
    status:       'pending_setup',
    addressLine1: '123 Main St',
    city:         'Toronto',
    state:        'ON',
    country:      'CA',
    postalCode:   'M5V 1A1',
    timezone:     'America/Toronto',
    maxCapacity:  50,
    createdAt:    NOW,
    updatedAt:    NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('Branch — constructor', () => {
  it('creates a pending_setup branch', () => {
    const b = make();
    expect(b.status).toBe('pending_setup');
    expect(b.isPendingSetup()).toBe(true);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when name is empty', () => {
    expect(() => make({ name: '' })).toThrow('name is required');
  });

  it('throws when addressLine1 is empty', () => {
    expect(() => make({ addressLine1: '' })).toThrow('addressLine1 is required');
  });

  it('throws when city is empty', () => {
    expect(() => make({ city: '' })).toThrow('city is required');
  });

  it('throws when state is empty', () => {
    expect(() => make({ state: '' })).toThrow('state is required');
  });

  it('throws when country is empty', () => {
    expect(() => make({ country: '' })).toThrow('country is required');
  });

  it('throws when postalCode is empty', () => {
    expect(() => make({ postalCode: '' })).toThrow('postalCode is required');
  });

  it('throws when timezone is empty', () => {
    expect(() => make({ timezone: '' })).toThrow('timezone is required');
  });

  it('throws when maxCapacity is 0', () => {
    expect(() => make({ maxCapacity: 0 })).toThrow('maxCapacity must be a positive integer');
  });

  it('throws when maxCapacity is negative', () => {
    expect(() => make({ maxCapacity: -1 })).toThrow('maxCapacity must be a positive integer');
  });

  it('throws when maxCapacity is non-integer', () => {
    expect(() => make({ maxCapacity: 1.5 })).toThrow('maxCapacity must be a positive integer');
  });

  it('accepts optional parentTenantId', () => {
    const b = make({ parentTenantId: 'parent-tenant-1' });
    expect(b.parentTenantId).toBe('parent-tenant-1');
  });
});

// ── Branch types ──────────────────────────────────────────────────────────────

describe('branch types', () => {
  const types: BranchType[] = ['franchise', 'corporate_owned', 'partner', 'virtual'];
  it.each(types)('accepts type: %s', (type) => {
    expect(() => make({ type })).not.toThrow();
  });
});

// ── activate() ────────────────────────────────────────────────────────────────

describe('activate()', () => {
  it('pending_setup → active', () => {
    const b = make().activate(LATER);
    expect(b.status).toBe('active');
    expect(b.isActive()).toBe(true);
    expect(b.openedAt).toEqual(LATER);
    expect(b.updatedAt).toEqual(LATER);
  });

  it('inactive → active', () => {
    const b = make({ status: 'inactive' }).activate(LATER);
    expect(b.status).toBe('active');
  });

  it('suspended → active', () => {
    const b = make({ status: 'suspended' }).activate(LATER);
    expect(b.status).toBe('active');
  });

  it('preserves existing openedAt on reactivation', () => {
    const b = make({ status: 'inactive', openedAt: NOW }).activate(LATER);
    expect(b.openedAt).toEqual(NOW);
  });

  it('throws when already active', () => {
    expect(() => make({ status: 'active' }).activate(LATER))
      .toThrow('pending_setup, inactive, or suspended');
  });
});

// ── suspend() ─────────────────────────────────────────────────────────────────

describe('suspend()', () => {
  it('active → suspended', () => {
    const b = make({ status: 'active' }).suspend(LATER);
    expect(b.status).toBe('suspended');
    expect(b.isSuspended()).toBe(true);
    expect(b.updatedAt).toEqual(LATER);
  });

  it('throws when not active', () => {
    expect(() => make().suspend(LATER)).toThrow('can only suspend an active');
  });
});

// ── reactivate() ──────────────────────────────────────────────────────────────

describe('reactivate()', () => {
  it('suspended → active', () => {
    const b = make({ status: 'suspended' }).reactivate(LATER);
    expect(b.status).toBe('active');
  });

  it('throws when not suspended', () => {
    expect(() => make({ status: 'active' }).reactivate(LATER)).toThrow('can only reactivate a suspended');
  });
});

// ── deactivate() ──────────────────────────────────────────────────────────────

describe('deactivate()', () => {
  it('active → inactive, sets closedAt', () => {
    const b = make({ status: 'active' }).deactivate(LATER);
    expect(b.status).toBe('inactive');
    expect(b.isInactive()).toBe(true);
    expect(b.closedAt).toEqual(LATER);
  });

  it('throws when not active', () => {
    expect(() => make().deactivate(LATER)).toThrow('can only deactivate an active');
  });
});

// ── rename() ──────────────────────────────────────────────────────────────────

describe('rename()', () => {
  it('updates name and updatedAt', () => {
    const b = make().rename('Uptown Studio', LATER);
    expect(b.name).toBe('Uptown Studio');
    expect(b.updatedAt).toEqual(LATER);
  });

  it('throws when name is empty', () => {
    expect(() => make().rename('', NOW)).toThrow('name is required');
  });
});

// ── setMaxCapacity() ──────────────────────────────────────────────────────────

describe('setMaxCapacity()', () => {
  it('updates maxCapacity', () => {
    const b = make().setMaxCapacity(100, LATER);
    expect(b.maxCapacity).toBe(100);
    expect(b.updatedAt).toEqual(LATER);
  });

  it('throws when capacity is 0', () => {
    expect(() => make().setMaxCapacity(0, NOW)).toThrow('maxCapacity must be a positive integer');
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('activate does not mutate original', () => {
    const original = make();
    original.activate(LATER);
    expect(original.status).toBe('pending_setup');
  });

  it('suspend does not mutate original', () => {
    const b = make({ status: 'active' });
    b.suspend(LATER);
    expect(b.status).toBe('active');
  });
});
