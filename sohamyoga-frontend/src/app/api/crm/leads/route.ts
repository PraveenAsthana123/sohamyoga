import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/crm/leads — active lead list for the Leads tab.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; first_name: string | null; last_name: string | null; email: string | null;
    source_platform: string | null; funnel_stage: string; lead_score: number | null;
    lead_temperature: string | null; created_at: string;
  }>(
    `SELECT id, first_name, last_name, email, source_platform, funnel_stage,
            lead_score, lead_temperature, created_at
     FROM campaign_lead WHERE funnel_stage NOT IN ('converted', 'disqualified')
     ORDER BY lead_score DESC NULLS LAST, created_at DESC LIMIT 100`,
  );

  return Response.json({
    leads: rows.rows.map(r => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || '(unnamed)',
      email: r.email ?? '—',
      source: r.source_platform ?? 'unknown',
      stage: r.funnel_stage,
      score: r.lead_score,
      temperature: r.lead_temperature,
      added: r.created_at,
    })),
  });
}
