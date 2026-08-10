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
    id: string; name: string; status: string; target_persona: string[];
    impressions: string | null; clicks: string | null; leads_captured: string | null; registrations: string | null;
  }>(
    `SELECT b.id, b.name, b.status, b.target_persona,
            SUM(a.impressions) AS impressions, SUM(a.clicks) AS clicks,
            SUM(a.leads_captured) AS leads_captured, SUM(a.registrations) AS registrations
     FROM campaign_brief b LEFT JOIN campaign_analytics a ON a.brief_id = b.id
     GROUP BY b.id ORDER BY b.start_date DESC LIMIT 50`,
  );

  return Response.json({
    campaigns: rows.rows.map(r => {
      const impressions = Number(r.impressions ?? 0);
      const clicks = Number(r.clicks ?? 0);
      return {
        id: r.id, name: r.name, status: r.status,
        segment: r.target_persona?.join(', ') || '—',
        sent: impressions,
        openRatePct: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
        ctrPct: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
        conversions: Number(r.registrations ?? 0),
      };
    }),
  });
}
