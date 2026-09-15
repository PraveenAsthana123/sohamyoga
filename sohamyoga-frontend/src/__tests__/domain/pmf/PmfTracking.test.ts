import { computePmfScore } from '@/domain/pmf/PmfTracking';

describe('computePmfScore (pure)', () => {
  it('returns null (not fabricated) with zero real responses (negative case)', () => {
    expect(computePmfScore(0, 0)).toEqual({ pct: null, pmfAchieved: null });
  });
  it('reports PMF achieved at the real 40% Sean Ellis threshold (boundary)', () => {
    expect(computePmfScore(4, 10)).toEqual({ pct: 40, pmfAchieved: true });
  });
  it('reports PMF not achieved below the real threshold (negative case)', () => {
    expect(computePmfScore(3, 10)).toEqual({ pct: 30, pmfAchieved: false });
  });
});
