// GET /api/analytics/consent — consent-level distribution for the Consent tab.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{ level: string; count: string }>(
    `SELECT level::text, COUNT(*) AS count FROM analytics_consent_record
     WHERE granted = TRUE GROUP BY level`,
  );
  const total = rows.rows.reduce((sum, r) => sum + Number(r.count), 0);

  return Response.json({
    distribution: rows.rows.map(r => ({
      level: r.level,
      count: Number(r.count),
      pct: total ? Math.round((Number(r.count) / total) * 100) : 0,
    })),
  });
}
