import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query(
    `SELECT window_date, negative_count, baseline_mean, baseline_stddev, baseline_days, z_score, is_crisis, computed_at
     FROM crisis_signal ORDER BY window_date DESC LIMIT 30`,
  );
  return Response.json({ signals: result.rows });
}
