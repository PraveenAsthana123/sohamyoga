// Shared Health Model -- the common scoring methodology behind every
// per-domain health score in this codebase (Brand Health, Research Health,
// and any future one). Before this, each health score (BrandHealthScore.ts,
// ResearchHealthScore.ts, ...) independently re-implemented the same
// 0-100 scale, weighted-average combination, and 80/50 traffic-light
// thresholds. This module makes that shared methodology real and
// referenced, not just a documented convention nobody enforces.

export interface WeightedComponent {
  score: number;  // 0-100
  weight: number; // relative weight, any positive number -- normalized internally
}

export type TrafficLight = 'green' | 'amber' | 'red';

export const HEALTH_MODEL_THRESHOLDS = { green: 80, amber: 50 } as const;

/** Weighted average of 0-100 component scores, rounded to the nearest
 * integer. Equal weights (all 1) reduces to a plain average, which is what
 * ResearchHealthScore.ts already used before adopting this shared model. */
export function combineWeightedScore(components: WeightedComponent[]): number {
  if (!components.length) return 100;
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 100;
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

/** The one canonical traffic-light mapping: >=80 green, 50-79 amber, <50 red. */
export function trafficLightFor(score: number): TrafficLight {
  if (score >= HEALTH_MODEL_THRESHOLDS.green) return 'green';
  if (score >= HEALTH_MODEL_THRESHOLDS.amber) return 'amber';
  return 'red';
}
