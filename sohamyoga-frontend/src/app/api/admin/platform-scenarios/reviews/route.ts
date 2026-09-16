import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const sp = new URL(req.url).searchParams;
  const platform = sp.get('platform') ?? '';
  const rating = sp.get('rating') ?? '';
  const sentiment = sp.get('sentiment') ?? '';

  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (platform) { conditions.push(`platform=$${vals.length+1}`); vals.push(platform); }
  if (rating) { conditions.push(`FLOOR(rating)=$${vals.length+1}`); vals.push(Number(rating)); }
  if (sentiment) { conditions.push(`sentiment=$${vals.length+1}`); vals.push(sentiment); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM platform_review ${where} ORDER BY published_at DESC NULLS LAST LIMIT 200`, vals);

  // KPI summary
  const kpi = await query(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(rating),1) AS avg_rating,
      COUNT(*) FILTER (WHERE response_text IS NOT NULL) AS responded,
      COUNT(*) FILTER (WHERE sentiment='negative') AS negative_count
    FROM platform_review
    ${platform ? `WHERE platform=$1` : ''}
  `, platform ? [platform] : []);

  return Response.json({ reviews: rows.rows, kpi: kpi.rows[0] });
}
