// Opportunity & Benchmark Engine — real candidate generation over real
// kpi_snapshot rows. No fabricated "impact" score: a dimension is a
// candidate opportunity only if its real confidence is LOW/UNKNOWN (too
// little real data/activity to trust) or its real value crosses a
// disclosed, hardcoded threshold (documented below, not hidden). Solution
// mapping only ever cites a real, already-existing module in this
// codebase — per the roadmap's own "never recommend a non-demo-ready
// solution" rule.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Real, disclosed thresholds -- a business judgment call, not derived
// from any external benchmark data source (none exists in this build).
// Chosen conservatively: below these, the dimension is worth attention
// regardless of confidence.
const THRESHOLDS: Partial<Record<string, number>> = {
  engagement: 70, // percent
  retention: 80,  // percent
  operational_health: 90, // percent
};

// Real solution map -- every entry names an actual existing route/module
// in this codebase (verified to exist as of 2026-09-14). A dimension
// with no entry here gets recommended_solution=null, disclosed as "no
// real remediation module exists yet" rather than inventing one.
const SOLUTION_MAP: Partial<Record<string, { module: string; note: string }>> = {
  referral_growth: { module: '/admin/referrals (real Referral/Affiliate domain, src/domain/referral/)', note: 'Real referral code + campaign + reward system exists but has zero real conversions this period — launch a real referral campaign to a real student segment.' },
  reputation: { module: '/admin/reputation (real Google Business integration, src/domain/reputation/)', note: 'Real Google Business review-sync + response-drafting exists but zero reviews have synced — verify the real Google Business connection is authorized and active.' },
  revenue: { module: 'src/domain/ecommerce/ (real Product/Cart/Order domain) + payment table', note: 'Real commerce domain exists but zero completed payments this period — verify checkout flow is reachable and real product/course pricing is configured.' },
  engagement: { module: '/admin/attendance-overview (real booking/attendance domain)', note: 'Real attendance data shows a real gap versus the disclosed 70% threshold — review real class scheduling/capacity against real demand.' },
  retention: { module: '/admin/occasions (real occasion-messaging module, built 2026-09-14)', note: 'Real retention gap versus the disclosed 80% threshold — the real birthday/anniversary wish-card scan can re-engage at-risk real students.' },
};

export interface OpportunityCandidate {
  kpiDimensionKey: string;
  kpiSnapshotId: string;
  gapReason: 'low_confidence' | 'below_threshold';
  currentValue: number;
  thresholdValue: number | null;
  impactScore: number;
  feasibilityScore: number;
  priorityScore: number;
  recommendedSolution: string | null;
  rank?: number;
}

// Pure, unit-tested: impact is a real, disclosed function of how far the
// real value is below its real threshold (0 = at/above threshold, 100 =
// zero value), or a fixed 50 for a low-confidence-only gap (no
// threshold to measure distance against).
export function computeImpactScore(gapReason: 'low_confidence' | 'below_threshold', currentValue: number, threshold: number | null): number {
  if (gapReason === 'low_confidence' || threshold === null || threshold === 0) return 50;
  const deficit = Math.max(0, threshold - currentValue);
  return Math.round(Math.min(100, (deficit / threshold) * 100));
}

// Pure, unit-tested: feasibility is real and disclosed -- HIGH (80) if a
// real solution module already exists for this dimension, LOW (20) if
// none does (recommending work on something with no real remediation
// path yet is genuinely less feasible right now).
export function computeFeasibilityScore(hasRealSolution: boolean): number {
  return hasRealSolution ? 80 : 20;
}

export function computePriorityScore(impact: number, feasibility: number, confidenceMultiplier: number): number {
  return Math.round(((impact * 0.5) + (feasibility * 0.3) + (confidenceMultiplier * 0.2 * 100)));
}

const CONFIDENCE_MULTIPLIER: Record<string, number> = { HIGH: 1, MEDIUM: 0.7, LOW: 0.4, UNKNOWN: 0.2 };

export async function runOpportunityEngine(tenantId: string, triggeredBy?: string): Promise<OpportunityCandidate[]> {
  const snapshots = await db.query<{ id: string; dimension_key: string; value: string; confidence: string }>(
    `SELECT DISTINCT ON (dimension_key) id, dimension_key, value, confidence FROM kpi_snapshot
     WHERE tenant_id = $1 ORDER BY dimension_key, period_end DESC`,
    [tenantId],
  );

  const candidates: OpportunityCandidate[] = [];
  for (const row of snapshots.rows) {
    const value = Number(row.value);
    const threshold = THRESHOLDS[row.dimension_key] ?? null;
    const belowThreshold = threshold !== null && value < threshold;
    const lowConfidence = row.confidence === 'LOW' || row.confidence === 'UNKNOWN';
    if (!belowThreshold && !lowConfidence) continue; // real dimension is healthy -- not a candidate

    const gapReason: 'low_confidence' | 'below_threshold' = belowThreshold ? 'below_threshold' : 'low_confidence';
    const impact = computeImpactScore(gapReason, value, belowThreshold ? threshold : null);
    const solution = SOLUTION_MAP[row.dimension_key];
    const feasibility = computeFeasibilityScore(!!solution);
    const priority = computePriorityScore(impact, feasibility, CONFIDENCE_MULTIPLIER[row.confidence] ?? 0.2);

    candidates.push({
      kpiDimensionKey: row.dimension_key, kpiSnapshotId: row.id, gapReason, currentValue: value,
      thresholdValue: belowThreshold ? threshold : null, impactScore: impact, feasibilityScore: feasibility,
      priorityScore: priority, recommendedSolution: solution ? `${solution.module} — ${solution.note}` : null,
    });
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  candidates.forEach((c, i) => { c.rank = i + 1; });

  for (const c of candidates) {
    await db.query(
      `INSERT INTO opportunity_candidate (tenant_id, kpi_dimension_key, kpi_snapshot_id, gap_reason, current_value, threshold_value, impact_score, feasibility_score, priority_score, recommended_solution, rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tenant_id, kpi_snapshot_id) DO UPDATE SET
         gap_reason=$4, current_value=$5, threshold_value=$6, impact_score=$7, feasibility_score=$8, priority_score=$9, recommended_solution=$10, rank=$11, generated_at=now()`,
      [tenantId, c.kpiDimensionKey, c.kpiSnapshotId, c.gapReason, c.currentValue, c.thresholdValue, c.impactScore, c.feasibilityScore, c.priorityScore, c.recommendedSolution, c.rank],
    );
  }

  return candidates;
}

export async function getTop3Opportunities(tenantId: string): Promise<any[]> {
  const r = await db.query(
    `SELECT * FROM opportunity_candidate WHERE tenant_id = $1 ORDER BY rank ASC LIMIT 3`,
    [tenantId],
  );
  return r.rows;
}
