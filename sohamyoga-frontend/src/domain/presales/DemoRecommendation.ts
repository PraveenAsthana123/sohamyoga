// Demo Recommendation Engine — backlog item #16. Reuses the real
// Opportunity Engine's recommendedSolution (already a real pointer to
// an existing, demo-ready module) rather than building a parallel
// recommendation model. Per the roadmap's own rule (Epic N): never
// recommend a demo for a capability that isn't itself real.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getRecommendedDemo(tenantId: string) {
  const r = await db.query<{ kpi_dimension_key: string; priority_score: number; recommended_solution: string | null }>(
    `SELECT kpi_dimension_key, priority_score, recommended_solution FROM opportunity_candidate WHERE tenant_id = $1 ORDER BY rank ASC LIMIT 1`,
    [tenantId],
  );
  if (!r.rowCount || !r.rows[0].recommended_solution) {
    return { hasRecommendation: false, reason: 'No real opportunity with a mapped real solution exists yet -- run the Opportunity Engine first.' };
  }
  return { hasRecommendation: true, dimension: r.rows[0].kpi_dimension_key, priorityScore: r.rows[0].priority_score, demo: r.rows[0].recommended_solution };
}
