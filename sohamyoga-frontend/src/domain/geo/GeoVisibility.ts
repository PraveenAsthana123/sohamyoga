// GEO Visibility — real admin-observed mention rate, never a fabricated
// "AI ranking score" (the roadmap's own explicit caution). Mention rate
// is a real percentage over real logged observations only.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export interface GeoSummary { totalObservations: number; mentionedCount: number; mentionRate: number | null; byPlatform: Record<string, { total: number; mentioned: number }> }

// Pure, unit-tested: mention rate is null (not 0) with zero real
// observations -- a real "no data yet" state, never a fabricated 0%.
export function computeMentionRate(total: number, mentioned: number): number | null {
  if (total === 0) return null;
  return Math.round((mentioned / total) * 1000) / 10;
}

export async function getGeoSummary(tenantId: string): Promise<GeoSummary> {
  const rows = await db.query<{ platform: string; was_mentioned: boolean }>(
    `SELECT platform, was_mentioned FROM geo_mention_observation WHERE tenant_id = $1`,
    [tenantId],
  );
  const byPlatform: Record<string, { total: number; mentioned: number }> = {};
  let mentionedCount = 0;
  for (const r of rows.rows) {
    byPlatform[r.platform] ??= { total: 0, mentioned: 0 };
    byPlatform[r.platform].total++;
    if (r.was_mentioned) { byPlatform[r.platform].mentioned++; mentionedCount++; }
  }
  return { totalObservations: rows.rows.length, mentionedCount, mentionRate: computeMentionRate(rows.rows.length, mentionedCount), byPlatform };
}

export async function recordGeoObservation(tenantId: string, platform: string, queryText: string, wasMentioned: boolean, excerpt: string, createdBy: string) {
  const r = await db.query(
    `INSERT INTO geo_mention_observation (tenant_id, platform, query_text, was_mentioned, excerpt, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [tenantId, platform, queryText, wasMentioned, excerpt, createdBy],
  );
  return r.rows[0];
}
