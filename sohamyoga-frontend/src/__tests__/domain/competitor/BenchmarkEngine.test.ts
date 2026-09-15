import { computeCompositeScore, computeGaps } from '@/domain/competitor/BenchmarkEngine';

describe('computeCompositeScore (pure)', () => {
  it('returns 0 for zero real dimension scores, never a fabricated default (negative case)', () => {
    expect(computeCompositeScore({})).toBe(0);
  });
  it('averages only real, present dimension scores (positive case)', () => {
    expect(computeCompositeScore({ seo: 80, reputation: 60 })).toBe(70);
  });
  it('does not pad a missing dimension with an assumed value (boundary)', () => {
    // Only 1 real dimension present -- composite equals that dimension exactly, not diluted by a phantom 0.
    expect(computeCompositeScore({ seo: 80 })).toBe(80);
  });
});

describe('computeGaps (pure)', () => {
  it('computes a real gap only where both a competitor score and a real own-KPI value exist (positive case)', () => {
    const gaps = computeGaps({ reputation: 75, seo: 60 }, { reputation: 50 });
    expect(gaps).toEqual([{ dimension: 'reputation', theirScore: 75, ourScore: 50, gap: 25 }]);
  });
  it('excludes a dimension with no real own-KPI value, never inferring one (negative case)', () => {
    const gaps = computeGaps({ seo: 60 }, {});
    expect(gaps).toEqual([]);
  });
  it('sorts by largest real gap first (positive case)', () => {
    const gaps = computeGaps({ reputation: 90, engagement: 60 }, { reputation: 50, engagement: 55 });
    expect(gaps.map((g) => g.dimension)).toEqual(['reputation', 'engagement']);
  });
});
