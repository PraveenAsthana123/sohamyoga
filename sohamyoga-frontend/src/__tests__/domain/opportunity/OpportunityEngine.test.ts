import { computeImpactScore, computeFeasibilityScore, computePriorityScore } from '@/domain/opportunity/OpportunityEngine';

describe('computeImpactScore (pure)', () => {
  it('returns 50 for a low-confidence-only gap with no threshold (boundary)', () => {
    expect(computeImpactScore('low_confidence', 10, null)).toBe(50);
  });
  it('returns 100 for a real value of zero against a real threshold (positive case)', () => {
    expect(computeImpactScore('below_threshold', 0, 70)).toBe(100);
  });
  it('returns 0 when the real value meets or exceeds the threshold (negative case)', () => {
    expect(computeImpactScore('below_threshold', 70, 70)).toBe(0);
    expect(computeImpactScore('below_threshold', 90, 70)).toBe(0);
  });
  it('computes a real proportional deficit (positive case)', () => {
    expect(computeImpactScore('below_threshold', 35, 70)).toBe(50);
  });
});

describe('computeFeasibilityScore (pure)', () => {
  it('returns 80 when a real solution module exists (positive case)', () => {
    expect(computeFeasibilityScore(true)).toBe(80);
  });
  it('returns 20 when no real solution module exists, never fabricated as feasible (negative case)', () => {
    expect(computeFeasibilityScore(false)).toBe(20);
  });
});

describe('computePriorityScore (pure)', () => {
  it('weights impact highest, then feasibility, then confidence (positive case)', () => {
    // impact=100*0.5=50, feasibility=80*0.3=24, confidence(HIGH=1)*0.2*100=20 -> 94
    expect(computePriorityScore(100, 80, 1)).toBe(94);
  });
  it('scores lowest for a low-impact, low-feasibility, low-confidence candidate (boundary)', () => {
    expect(computePriorityScore(0, 0, 0)).toBe(0);
  });
});
