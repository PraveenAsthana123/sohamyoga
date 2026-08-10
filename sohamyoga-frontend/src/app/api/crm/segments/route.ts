// GET /api/crm/segments — computed customer segments (rule-based, not stored).
// Each segment's definition mirrors the previous mock UI's categories, computed
// live against the customer/churn_prediction tables rather than hardcoded counts.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [highValue, atRisk, winBack, corporate] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM customer WHERE tier IN ('gold','platinum') AND lifetime_spend_cad > 1200`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM churn_prediction WHERE risk_level IN ('high','critical')`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM customer WHERE last_purchase_at < now() - interval '60 days' AND tier IN ('gold','platinum')`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM campaign_lead WHERE funnel_stage NOT IN ('converted','disqualified') AND source_platform = 'linkedin_lead'`),
  ]);

  return Response.json({
    segments: [
      { name: 'High-Value Members', count: Number(highValue.rows[0]?.count ?? 0), desc: 'Gold/Platinum tier, lifetime spend > $1,200' },
      { name: 'At-Risk Members', count: Number(atRisk.rows[0]?.count ?? 0), desc: 'Ollama-flagged high/critical churn risk' },
      { name: 'Win-Back Candidates', count: Number(winBack.rows[0]?.count ?? 0), desc: 'Lapsed > 60 days, previously Gold+' },
      { name: 'Corporate Prospects', count: Number(corporate.rows[0]?.count ?? 0), desc: 'LinkedIn leads, not yet converted' },
    ],
  });
}
