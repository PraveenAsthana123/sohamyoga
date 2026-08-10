import { describe, it, expect } from '@jest/globals';
import { FranchiseAgreement, type FranchiseAgreementProps } from '../../../domain/enterprise/FranchiseAgreement';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const START  = new Date('2026-01-01T00:00:00Z');
const END    = new Date('2027-01-01T00:00:00Z');
const BEFORE = new Date('2025-12-31T00:00:00Z');

function make(overrides?: Partial<FranchiseAgreementProps>): FranchiseAgreement {
  return new FranchiseAgreement({
    id:                  'fa-1',
    tenantId:            'franchisor-1',
    franchiseeTenantId:  'franchisee-1',
    branchId:            'branch-1',
    status:              'draft',
    royaltyPercent:      10,
    setupFee:            500000,  // $5,000 in cents
    monthlyFee:          100000,  // $1,000 in cents
    currency:            'CAD',
    startDate:           START,
    endDate:             END,
    createdAt:           NOW,
    updatedAt:           NOW,
    ...overrides,
  });
}

function makeSigned(overrides?: Partial<FranchiseAgreementProps>): FranchiseAgreement {
  return make({
    status: 'active',
    signedByFranchisor: 'Alice Corp',
    signedByFranchisee: 'Bob Yoga',
    signedAt: NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('FranchiseAgreement — constructor', () => {
  it('creates a draft agreement', () => {
    const fa = make();
    expect(fa.status).toBe('draft');
    expect(fa.isDraft()).toBe(true);
    expect(fa.royaltyPercent).toBe(10);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when franchiseeTenantId is empty', () => {
    expect(() => make({ franchiseeTenantId: '' })).toThrow('franchiseeTenantId is required');
  });

  it('throws when branchId is empty', () => {
    expect(() => make({ branchId: '' })).toThrow('branchId is required');
  });

  it('throws when royaltyPercent < 0', () => {
    expect(() => make({ royaltyPercent: -1 })).toThrow('royaltyPercent must be between 0 and 100');
  });

  it('throws when royaltyPercent > 100', () => {
    expect(() => make({ royaltyPercent: 101 })).toThrow('royaltyPercent must be between 0 and 100');
  });

  it('accepts royaltyPercent at boundaries (0 and 100)', () => {
    expect(() => make({ royaltyPercent: 0 })).not.toThrow();
    expect(() => make({ royaltyPercent: 100 })).not.toThrow();
  });

  it('throws when setupFee is negative', () => {
    expect(() => make({ setupFee: -1 })).toThrow('setupFee must be a non-negative integer');
  });

  it('throws when setupFee is non-integer', () => {
    expect(() => make({ setupFee: 99.5 })).toThrow('setupFee must be a non-negative integer');
  });

  it('throws when monthlyFee is negative', () => {
    expect(() => make({ monthlyFee: -1 })).toThrow('monthlyFee must be a non-negative integer');
  });

  it('accepts zero fees', () => {
    expect(() => make({ setupFee: 0, monthlyFee: 0 })).not.toThrow();
  });

  it('throws when currency is not 3 uppercase letters', () => {
    expect(() => make({ currency: 'usd' })).toThrow('3-letter ISO 4217');
    expect(() => make({ currency: 'US'  })).toThrow('3-letter ISO 4217');
    expect(() => make({ currency: 'USDD' })).toThrow('3-letter ISO 4217');
  });

  it('throws when endDate is not after startDate', () => {
    expect(() => make({ endDate: START })).toThrow('endDate must be after startDate');
    expect(() => make({ endDate: BEFORE })).toThrow('endDate must be after startDate');
  });

  it('throws when active but missing signatures', () => {
    expect(() => make({ status: 'active' })).toThrow('requires both signatures');
  });

  it('throws when terminated but no reason', () => {
    expect(() => make({ status: 'terminated' })).toThrow('requires terminationReason');
  });

  it('creates valid active agreement with both signatures', () => {
    const fa = makeSigned();
    expect(fa.isActive()).toBe(true);
    expect(fa.signedByFranchisor).toBe('Alice Corp');
  });
});

// ── sign() ────────────────────────────────────────────────────────────────────

describe('sign()', () => {
  it('draft → active, sets signatures and signedAt', () => {
    const fa = make().sign('Alice Corp', 'Bob Yoga', LATER);
    expect(fa.status).toBe('active');
    expect(fa.isActive()).toBe(true);
    expect(fa.signedByFranchisor).toBe('Alice Corp');
    expect(fa.signedByFranchisee).toBe('Bob Yoga');
    expect(fa.signedAt).toEqual(LATER);
    expect(fa.updatedAt).toEqual(LATER);
  });

  it('throws when not draft', () => {
    expect(() => makeSigned().sign('A', 'B', LATER)).toThrow('can only sign a draft');
  });

  it('throws when franchisor name is empty', () => {
    expect(() => make().sign('', 'Bob', LATER)).toThrow('franchisor name is required');
  });

  it('throws when franchisee name is empty', () => {
    expect(() => make().sign('Alice', '', LATER)).toThrow('franchisee name is required');
  });
});

// ── expire() ──────────────────────────────────────────────────────────────────

describe('expire()', () => {
  it('active → expired', () => {
    const fa = makeSigned().expire(LATER);
    expect(fa.status).toBe('expired');
    expect(fa.isExpired()).toBe(true);
  });

  it('throws when not active', () => {
    expect(() => make().expire(LATER)).toThrow('can only expire an active');
  });
});

// ── terminate() ───────────────────────────────────────────────────────────────

describe('terminate()', () => {
  it('active → terminated, sets reason and terminatedAt', () => {
    const fa = makeSigned().terminate('Breach of contract', LATER);
    expect(fa.status).toBe('terminated');
    expect(fa.isTerminated()).toBe(true);
    expect(fa.terminationReason).toBe('Breach of contract');
    expect(fa.terminatedAt).toEqual(LATER);
  });

  it('throws when not active', () => {
    expect(() => make().terminate('reason', LATER)).toThrow('can only terminate an active');
  });

  it('throws when reason is empty', () => {
    expect(() => makeSigned().terminate('', LATER)).toThrow('terminationReason is required');
  });
});

// ── updateRoyalty() ───────────────────────────────────────────────────────────

describe('updateRoyalty()', () => {
  it('updates royalty on active agreement', () => {
    const fa = makeSigned().updateRoyalty(15, LATER);
    expect(fa.royaltyPercent).toBe(15);
    expect(fa.updatedAt).toEqual(LATER);
  });

  it('throws when not active', () => {
    expect(() => make().updateRoyalty(15, LATER)).toThrow('can only update royalty on an active');
  });

  it('throws when royalty out of range', () => {
    expect(() => makeSigned().updateRoyalty(101, LATER)).toThrow('royaltyPercent');
  });
});

// ── monthlyRoyaltyAmount() ────────────────────────────────────────────────────

describe('monthlyRoyaltyAmount()', () => {
  it('computes 10% of $1,000 = $100 (10000 cents)', () => {
    expect(make().monthlyRoyaltyAmount()).toBe(10000);
  });

  it('computes 0% royalty', () => {
    expect(make({ royaltyPercent: 0 }).monthlyRoyaltyAmount()).toBe(0);
  });

  it('computes 100% royalty', () => {
    expect(make({ royaltyPercent: 100, monthlyFee: 100000 }).monthlyRoyaltyAmount()).toBe(100000);
  });

  it('rounds fractional cents', () => {
    const fa = make({ royaltyPercent: 33, monthlyFee: 100 });
    expect(Number.isInteger(fa.monthlyRoyaltyAmount())).toBe(true);
  });
});

// ── isExpiredByDate() ─────────────────────────────────────────────────────────

describe('isExpiredByDate()', () => {
  it('returns false before endDate', () => {
    expect(make().isExpiredByDate(NOW)).toBe(false);
  });

  it('returns true at endDate', () => {
    expect(make().isExpiredByDate(END)).toBe(true);
  });

  it('returns true after endDate', () => {
    const after = new Date('2028-01-01T00:00:00Z');
    expect(make().isExpiredByDate(after)).toBe(true);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('sign does not mutate original', () => {
    const original = make();
    original.sign('Alice', 'Bob', LATER);
    expect(original.status).toBe('draft');
  });

  it('terminate does not mutate original', () => {
    const signed = makeSigned();
    signed.terminate('reason', LATER);
    expect(signed.status).toBe('active');
  });
});
