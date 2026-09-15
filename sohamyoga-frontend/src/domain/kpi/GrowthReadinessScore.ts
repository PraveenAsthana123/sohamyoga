// Growth Readiness Score — backlog item #7, rolls the real 8 KPI
// dimensions (built in item #2) into one real headline score. Only the
// dimensions already on a real, comparable 0-100 scale (percent or
// score_0_100 units: engagement, retention, operational_health,
// wellness_outcomes, reputation) are averaged in -- count/currency
// dimensions (acquisition, referral_growth, revenue) have no honest
// 0-100 normalization without an external benchmark this build doesn't
// have, so they're excluded from the score itself and shown as raw
// context instead of being force-fit into a fabricated scale.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCORABLE_UNITS = new Set(['percent', 'score_0_100']);
const CONFIDENCE_WEIGHT: Record<string, number> = { HIGH: 1, MEDIUM: 0.7, LOW: 0.4, UNKNOWN: 0.15 };

export interface KpiSnapshotRow { dimension_key: string; value: number; unit: string; confidence: string; sample_size: number }

// Pure, unit-tested: confidence-weighted average over only the real
// dimensions on a real 0-100 scale. Returns null (not 0) when there are
// no scorable dimensions yet -- a real "not enough data" state, never a
// fabricated zero.
export function computeGrowthReadinessScore(snapshots: KpiSnapshotRow[]): { score: number | null; includedDimensions: string[]; excludedDimensions: string[] } {
  const scorable = snapshots.filter((s) => SCORABLE_UNITS.has(s.unit));
  const excluded = snapshots.filter((s) => !SCORABLE_UNITS.has(s.unit)).map((s) => s.dimension_key);
  if (scorable.length === 0) return { score: null, includedDimensions: [], excludedDimensions: excluded };

  let weightedSum = 0, totalWeight = 0;
  for (const s of scorable) {
    const w = CONFIDENCE_WEIGHT[s.confidence] ?? 0.15;
    weightedSum += s.value * w;
    totalWeight += w;
  }
  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
  return { score, includedDimensions: scorable.map((s) => s.dimension_key), excludedDimensions: excluded };
}

export async function getGrowthReadinessReport(tenantId: string) {
  const snapshots = await db.query<{ dimension_key: string; value: string; unit: string; confidence: string; sample_size: number; explanation: string }>(
    `SELECT DISTINCT ON (dimension_key) dimension_key, value, unit, confidence, sample_size, explanation
     FROM kpi_snapshot WHERE tenant_id = $1 ORDER BY dimension_key, period_end DESC`,
    [tenantId],
  );
  const rows = snapshots.rows.map((r) => ({ ...r, value: Number(r.value) }));
  const { score, includedDimensions, excludedDimensions } = computeGrowthReadinessScore(rows);

  const opportunities = await db.query(
    `SELECT kpi_dimension_key, priority_score, recommended_solution FROM opportunity_candidate WHERE tenant_id = $1 ORDER BY rank ASC LIMIT 3`,
    [tenantId],
  );

  return {
    growthReadinessScore: score,
    includedDimensions, excludedDimensions,
    dimensions: rows,
    topOpportunities: opportunities.rows,
    // Two-tier report: customer one-pager is the minimal public-safe view; internal deep report is everything.
    customerOnePager: {
      headline: score !== null ? `Growth Readiness Score: ${score}/100` : 'Not enough real data yet to compute a Growth Readiness Score.',
      topOpportunity: opportunities.rows[0]?.recommended_solution ?? null,
    },
  };
}
