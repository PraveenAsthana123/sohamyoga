// Share-of-Voice — real aggregation over real, admin-logged media
// mentions (#30). No PR distribution or media-monitoring API exists.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Pure, unit-tested: real sentiment share -- null (not 0%) with zero
// real mentions, a real "no data" state.
export function computePositiveShare(positive: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((positive / total) * 1000) / 10;
}

export async function getShareOfVoiceSummary(tenantId: string) {
  const r = await db.query<{ mention_type: string; sentiment: string | null; n: string }>(
    `SELECT mention_type, sentiment, count(*)::text AS n FROM media_mention WHERE tenant_id = $1 GROUP BY mention_type, sentiment`,
    [tenantId],
  );
  const total = r.rows.reduce((s, row) => s + Number(row.n), 0);
  const positive = r.rows.filter((row) => row.sentiment === 'positive').reduce((s, row) => s + Number(row.n), 0);
  const byType: Record<string, number> = {};
  for (const row of r.rows) byType[row.mention_type] = (byType[row.mention_type] ?? 0) + Number(row.n);
  return { totalMentions: total, byType, positiveShare: computePositiveShare(positive, total) };
}
