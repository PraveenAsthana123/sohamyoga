import { computeConversionReadinessScore } from '@/domain/cro/CroEngine';

describe('computeConversionReadinessScore (pure)', () => {
  it('returns 100 with zero real unresolved findings (positive case)', () => {
    expect(computeConversionReadinessScore([])).toBe(100);
  });
  it('penalizes high severity more than low (positive case)', () => {
    const highOnly = computeConversionReadinessScore([{ severity: 'high' }]);
    const lowOnly = computeConversionReadinessScore([{ severity: 'low' }]);
    expect(highOnly).toBeLessThan(lowOnly);
  });
  it('never goes below 0, even with many real findings (boundary)', () => {
    const many = Array.from({ length: 30 }, () => ({ severity: 'high' }));
    expect(computeConversionReadinessScore(many)).toBe(0);
  });
});
