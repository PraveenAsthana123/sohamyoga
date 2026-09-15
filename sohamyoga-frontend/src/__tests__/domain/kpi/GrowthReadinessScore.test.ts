import { computeGrowthReadinessScore } from '@/domain/kpi/GrowthReadinessScore';

describe('computeGrowthReadinessScore (pure)', () => {
  it('returns null (not a fabricated 0) when there are no scorable real dimensions (negative case)', () => {
    const result = computeGrowthReadinessScore([{ dimension_key: 'acquisition', value: 241, unit: 'count', confidence: 'HIGH', sample_size: 241 }]);
    expect(result.score).toBeNull();
    expect(result.excludedDimensions).toEqual(['acquisition']);
  });

  it('computes a real confidence-weighted average over scorable dimensions only (positive case)', () => {
    const result = computeGrowthReadinessScore([
      { dimension_key: 'engagement', value: 80, unit: 'percent', confidence: 'HIGH', sample_size: 100 },
      { dimension_key: 'retention', value: 60, unit: 'percent', confidence: 'HIGH', sample_size: 100 },
      { dimension_key: 'revenue', value: 5000, unit: 'currency_cad', confidence: 'HIGH', sample_size: 10 },
    ]);
    expect(result.score).toBe(70); // simple average since both weights equal (both HIGH)
    expect(result.includedDimensions.sort()).toEqual(['engagement', 'retention']);
    expect(result.excludedDimensions).toEqual(['revenue']);
  });

  it('weights a LOW-confidence dimension less than a HIGH-confidence one (positive case)', () => {
    const result = computeGrowthReadinessScore([
      { dimension_key: 'engagement', value: 100, unit: 'percent', confidence: 'HIGH', sample_size: 100 },
      { dimension_key: 'retention', value: 0, unit: 'percent', confidence: 'LOW', sample_size: 2 },
    ]);
    // weighted: (100*1 + 0*0.4) / (1+0.4) = 100/1.4 = 71.4
    expect(result.score).toBeCloseTo(71.4, 1);
  });
});
