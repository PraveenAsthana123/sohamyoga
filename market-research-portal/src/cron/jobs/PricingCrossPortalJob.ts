// PricingCrossPortalJob — real cross-database read of sohamyoga's live
// pricing_plan_master/pricing_plan_price via the explicitly READ-ONLY
// sohamyoga_ro role (GRANT SELECT only, verified — INSERT/CREATE TABLE
// both denied for this role). Writes a real live pricing snapshot into
// the Pricing phase_run's Automatic Process output for one study (or, on
// a scheduled/no-studyId run, every study that has a Pricing phase_run).
//
// This is 1 of the exactly-2 real external-data proofs of concept in this
// pass (the other is ReviewsCrossPortalJob) — every other phase's
// Automatic Process stays honestly "Not yet automated".

import { getSohamyogaReadOnlyPool, query } from '../../lib/postgres';
import { appendTransaction, setPhaseRunStatus } from '../../domain/pipeline/PipelineService';

const COMPETITOR_BENCHMARK_MIN = 30;
const COMPETITOR_BENCHMARK_MAX = 120;

interface PriceRow {
  plan_name: string;
  amount: string;
  currency: string;
  billing_cycle: string;
}

export interface PricingCrossPortalResult {
  status: 'succeeded' | 'no_data' | 'failed';
  phaseRunsUpdated: number;
  rowsRead: number;
}

async function updateOnePricingPhaseRun(phaseRunId: string, snapshotText: string): Promise<void> {
  await setPhaseRunStatus(phaseRunId, 'running');
  await query(`UPDATE phase_run SET output_content = $1, updated_at = now() WHERE id = $2`, [snapshotText, phaseRunId]);
  await appendTransaction(phaseRunId, 'pricing_cross_portal', 'Real cross-DB read of sohamyoga.pricing_plan_master/pricing_plan_price (read-only role sohamyoga_ro) refreshed this phase\'s Automatic Process output.');
  await setPhaseRunStatus(phaseRunId, 'completed');
}

export async function run(params: { studyId?: string } = {}): Promise<PricingCrossPortalResult> {
  const roPool = getSohamyogaReadOnlyPool();
  if (!roPool) {
    console.log('[pricing-cross-portal] SOHAMYOGA_RO_DATABASE_URL not configured, skipping');
    return { status: 'failed', phaseRunsUpdated: 0, rowsRead: 0 };
  }

  let snapshot: PriceRow[];
  try {
    const result = await roPool.query<PriceRow>(
      `SELECT m.name AS plan_name, p.amount::text AS amount, p.currency, p.billing_cycle
       FROM pricing_plan_price p
       JOIN pricing_plan_master m ON m.id = p.plan_id
       WHERE m.status = 'active' AND p.is_promotional = false
       ORDER BY p.amount DESC`,
    );
    snapshot = result.rows;
  } catch (err) {
    console.error('[pricing-cross-portal] cross-DB read failed:', err);
    return { status: 'failed', phaseRunsUpdated: 0, rowsRead: 0 };
  }

  if (!snapshot.length) {
    return { status: 'no_data', phaseRunsUpdated: 0, rowsRead: 0 };
  }

  const monthly = snapshot.filter(r => r.billing_cycle === 'monthly' && Number(r.amount) > 0);
  const refreshedAt = new Date().toISOString();
  const lines = snapshot.map(r => `- ${r.plan_name}: $${Number(r.amount).toFixed(2)} ${r.currency} / ${r.billing_cycle}`).join('\n');
  const range = monthly.length
    ? `SohamYoga's real live monthly plans span $${Math.min(...monthly.map(r => Number(r.amount))).toFixed(0)}-$${Math.max(...monthly.map(r => Number(r.amount))).toFixed(0)}/month against a documented competitor benchmark of $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month.`
    : `No monthly-billed sohamyoga plans are currently active to compare against the $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month competitor benchmark.`;
  const snapshotText = `Real cross-DB pricing snapshot from sohamyoga's live database (read-only, refreshed ${refreshedAt}):\n${lines}\n\nCompetitor benchmark range: $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month.\n\n${range}`;

  const targetRuns = params.studyId
    ? await query<{ id: string }>(
        `SELECT pr.id FROM phase_run pr JOIN phase p ON p.id = pr.phase_id WHERE pr.study_id = $1 AND p.slug = 'pricing'`,
        [params.studyId],
      )
    : await query<{ id: string }>(
        `SELECT pr.id FROM phase_run pr JOIN phase p ON p.id = pr.phase_id WHERE p.slug = 'pricing'`,
      );

  for (const row of targetRuns.rows) {
    await updateOnePricingPhaseRun(row.id, snapshotText);
  }

  console.log(`[pricing-cross-portal] refreshed ${targetRuns.rowCount} pricing phase_run(s) from ${snapshot.length} live sohamyoga price row(s)`);
  return { status: 'succeeded', phaseRunsUpdated: targetRuns.rowCount ?? 0, rowsRead: snapshot.length };
}
