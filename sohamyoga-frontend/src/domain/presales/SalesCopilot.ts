// Sales Conversation Copilot — backlog item #17. Real, deterministic
// talking-points composition from real evidence/KPI/opportunity data
// already built (#1-3, #14) -- not a live AI chat interface (out of
// scope for a single dogfooding tenant) and not model-generated (every
// talking point is a real, already-verified fact, never invented).

import { getGrowthBrief } from './GrowthBrief';

export interface TalkingPoint { topic: string; point: string }

export async function getSalesTalkingPoints(tenantId: string): Promise<TalkingPoint[]> {
  const brief = await getGrowthBrief(tenantId);
  const points: TalkingPoint[] = [];

  if (brief.growthReadinessScore !== null) {
    points.push({ topic: 'Opening', point: `Real Growth Readiness Score: ${brief.growthReadinessScore}/100, computed from ${brief.realEvidenceRecordCount} real logged evidence records.` });
  } else {
    points.push({ topic: 'Opening', point: 'Not enough real data yet for a Growth Readiness Score -- lead with a specific real gap instead.' });
  }

  for (const opp of brief.topOpportunities) {
    if (opp.recommended_solution) {
      points.push({ topic: `Opportunity: ${opp.kpi_dimension_key}`, point: opp.recommended_solution });
    }
  }

  points.push({ topic: 'Competitive context', point: brief.onePager.competitorNote });

  return points;
}
