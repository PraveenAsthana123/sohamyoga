// Pre-Sales Intelligence Engine — backlog item #14. Consolidates the
// real Evidence Ledger (#1), KPI Engine (#2), Opportunity Engine (#3),
// Competitor Benchmark (#4), and Growth Readiness Score (#7) already
// built this session into one real growth brief. No new data source --
// pure composition of already-real, already-verified data.

import { Pool } from 'pg';
import { getGrowthReadinessReport } from '@/domain/kpi/GrowthReadinessScore';
import { getBenchmarkSummary } from '@/domain/competitor/BenchmarkEngine';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getGrowthBrief(tenantId: string) {
  const [readiness, competitors, evidenceCount] = await Promise.all([
    getGrowthReadinessReport(tenantId),
    getBenchmarkSummary(tenantId),
    db.query<{ n: string }>(`SELECT count(*)::text AS n FROM evidence_record WHERE tenant_id = $1`, [tenantId]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    growthReadinessScore: readiness.growthReadinessScore,
    topOpportunities: readiness.topOpportunities,
    competitorCount: competitors.length,
    competitorGapsFound: competitors.flatMap((c) => c.gaps).length,
    realEvidenceRecordCount: Number(evidenceCount.rows[0]?.n ?? 0),
    onePager: {
      headline: readiness.customerOnePager.headline,
      topOpportunity: readiness.customerOnePager.topOpportunity,
      competitorNote: competitors.length > 0 ? `${competitors.length} real competitor(s) tracked, ${competitors.flatMap((c) => c.gaps).length} real head-to-head gap(s) identified.` : 'No competitors tracked yet.',
    },
  };
}
