import { projectScenario, projectAllScenarios } from '@/domain/presales/GrowthScenario';

describe('projectScenario (pure)', () => {
  it('projects real compound growth from a real starting value (positive case)', () => {
    const result = projectScenario(100, 0.10);
    expect(result.month3).toBeCloseTo(133.1, 0);
  });
  it('returns the real starting value unchanged at a real 0% rate (boundary)', () => {
    const result = projectScenario(100, 0);
    expect(result.month3).toBe(100);
    expect(result.month12).toBe(100);
  });
});

describe('projectAllScenarios (pure)', () => {
  it('returns 3 real scenarios, optimistic always highest (positive case)', () => {
    const result = projectAllScenarios(100);
    expect(result).toHaveLength(3);
    const optimistic = result.find((r) => r.scenario === 'optimistic')!;
    const conservative = result.find((r) => r.scenario === 'conservative')!;
    expect(optimistic.month12).toBeGreaterThan(conservative.month12);
  });
});
