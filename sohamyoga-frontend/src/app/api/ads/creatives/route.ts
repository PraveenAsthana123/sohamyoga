import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; ad_type: string; status: string; ai_generated: boolean;
    impression_count: string; click_count: string; spend_cents: string;
  }>(
    `SELECT id, name, ad_type::text, status::text, ai_generated, impression_count, click_count, spend_cents
     FROM advertisement ORDER BY created_at DESC`,
  );

  return Response.json({
    creatives: rows.rows.map(a => {
      const impressions = Number(a.impression_count);
      const clicks = Number(a.click_count);
      const spend = Number(a.spend_cents) / 100;
      return {
        id: a.id, name: a.name, type: a.ad_type, status: a.status, ai: a.ai_generated,
        impressions, clicks,
        ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks ? Math.round((spend / clicks) * 100) / 100 : 0,
      };
    }),
  });
}
