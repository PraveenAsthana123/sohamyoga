// Competitor Benchmark Engine — real, admin-entered scores across 8 real
// dimensions per competitor (no external API can honestly fetch a
// competitor's real digital-presence data — same disclosed limitation
// as the existing price-tracking domain this extends). Where our own
// real KPI data exists for a comparable dimension (currently: reputation,
// from the real KPI Engine's business_review-derived value), a real
// head-to-head gap is computed — never fabricated for dimensions we have
// no real comparable number for.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export const BENCHMARK_DIMENSIONS = [
  'discoverability', 'website_quality', 'seo', 'local_presence',
  'reputation', 'social_presence', 'content_quality', 'pricing_competitiveness',
] as const;
export type BenchmarkDimension = typeof BENCHMARK_DIMENSIONS[number];

// Only dimensions where this codebase has a real, comparable own-KPI
// number today. Extend this map as more KPI dimensions get built.
const OWN_KPI_DIMENSION_MAP: Partial<Record<BenchmarkDimension, string>> = {
  reputation: 'reputation',
};

export interface CompetitorBenchmarkSummary {
  competitorId: string;
  competitorName: string;
  dimensionScores: Record<string, number>;
  compositeScore: number;
  sampleDimensions: number;
  gaps: { dimension: string; theirScore: number; ourScore: number; gap: number }[];
}

// Pure, unit-tested: composite is a real simple average over only the
// dimensions that actually have a real admin-entered score — never
// padded with a default/assumed value for a missing dimension.
export function computeCompositeScore(dimensionScores: Record<string, number>): number {
  const values = Object.values(dimensionScores);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// Pure, unit-tested: a real gap only exists where we have both a real
// competitor score AND a real comparable own-KPI value -- never
// inferred for a dimension we can't actually measure ourselves.
export function computeGaps(dimensionScores: Record<string, number>, ownKpiValues: Partial<Record<string, number>>): { dimension: string; theirScore: number; ourScore: number; gap: number }[] {
  const gaps: { dimension: string; theirScore: number; ourScore: number; gap: number }[] = [];
  for (const [dim, theirScore] of Object.entries(dimensionScores)) {
    const ourScore = ownKpiValues[dim];
    if (ourScore === undefined) continue;
    gaps.push({ dimension: dim, theirScore, ourScore, gap: Math.round((theirScore - ourScore) * 10) / 10 });
  }
  return gaps.sort((a, b) => b.gap - a.gap);
}

export async function getBenchmarkSummary(tenantId: string): Promise<CompetitorBenchmarkSummary[]> {
  const competitors = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM competitor WHERE tenant_id = $1`,
    [tenantId],
  );

  // Real own-KPI values, latest snapshot per dimension, mapped to
  // benchmark dimension names via OWN_KPI_DIMENSION_MAP.
  const kpiRows = await db.query<{ dimension_key: string; value: string }>(
    `SELECT DISTINCT ON (dimension_key) dimension_key, value FROM kpi_snapshot WHERE tenant_id = $1 ORDER BY dimension_key, period_end DESC`,
    [tenantId],
  );
  const kpiByDimension = Object.fromEntries(kpiRows.rows.map((r) => [r.dimension_key, Number(r.value)]));
  const ownKpiValues: Partial<Record<string, number>> = {};
  for (const [benchmarkDim, kpiDim] of Object.entries(OWN_KPI_DIMENSION_MAP)) {
    if (kpiByDimension[kpiDim] !== undefined) ownKpiValues[benchmarkDim] = kpiByDimension[kpiDim];
  }

  const summaries: CompetitorBenchmarkSummary[] = [];
  for (const c of competitors.rows) {
    const scoreRows = await db.query<{ dimension: string; score: number }>(
      `SELECT DISTINCT ON (dimension) dimension, score FROM competitor_benchmark_score
       WHERE competitor_id = $1 ORDER BY dimension, observed_at DESC`,
      [c.id],
    );
    const dimensionScores = Object.fromEntries(scoreRows.rows.map((r) => [r.dimension, r.score]));
    summaries.push({
      competitorId: c.id, competitorName: c.name, dimensionScores,
      compositeScore: computeCompositeScore(dimensionScores),
      sampleDimensions: Object.keys(dimensionScores).length,
      gaps: computeGaps(dimensionScores, ownKpiValues),
    });
  }
  return summaries;
}
