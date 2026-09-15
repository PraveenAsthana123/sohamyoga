// Growth Scenario Simulator — backlog item #18. Real current values
// (from the real KPI Engine, #2) projected forward under real, explicitly
// disclosed growth-rate assumptions -- never presented as a prediction
// or fetched from any external market-data source (none exists in this
// build). Conservative/base/optimistic rates are stated plainly as
// assumptions the admin can disagree with, not derived from real data.

const SCENARIOS = [
  { name: 'conservative', monthlyGrowthRate: 0.02 },
  { name: 'base', monthlyGrowthRate: 0.05 },
  { name: 'optimistic', monthlyGrowthRate: 0.10 },
] as const;

export interface ScenarioProjection { scenario: string; monthlyGrowthRate: number; month3: number; month6: number; month12: number }

// Pure, unit-tested: real compound projection from a real starting
// value -- the assumption (rate) is the only non-real input, and it's
// returned alongside the result so it's never hidden.
export function projectScenario(currentValue: number, monthlyGrowthRate: number): { month3: number; month6: number; month12: number } {
  const project = (months: number) => Math.round(currentValue * Math.pow(1 + monthlyGrowthRate, months) * 10) / 10;
  return { month3: project(3), month6: project(6), month12: project(12) };
}

export function projectAllScenarios(currentValue: number): ScenarioProjection[] {
  return SCENARIOS.map((s) => ({ scenario: s.name, monthlyGrowthRate: s.monthlyGrowthRate, ...projectScenario(currentValue, s.monthlyGrowthRate) }));
}
