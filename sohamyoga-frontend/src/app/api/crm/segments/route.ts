// GET /api/crm/segments — computed customer segments (rule-based, not stored).
// Each segment's definition mirrors the previous mock UI's categories, computed
// live against the customer/churn_prediction tables rather than hardcoded counts.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { AudienceSegment, type SegmentCriteria, type SegmentLogic } from '@/domain/campaign/AudienceSegment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [highValue, atRisk, winBack, corporate, custom] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM customer WHERE tier IN ('gold','platinum') AND lifetime_spend_cad > 1200`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM churn_prediction WHERE risk_level IN ('high','critical')`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM customer WHERE last_purchase_at < now() - interval '60 days' AND tier IN ('gold','platinum')`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM campaign_lead WHERE funnel_stage NOT IN ('converted','disqualified') AND source_platform = 'linkedin_lead'`),
    query<{ id: string; name: string; description: string; estimated_size: number; last_computed_at: Date | null }>(
      `SELECT id, name, description, estimated_size, last_computed_at FROM audience_segment ORDER BY created_at DESC`,
    ),
  ]);

  return Response.json({
    segments: [
      { name: 'High-Value Members', count: Number(highValue.rows[0]?.count ?? 0), desc: 'Gold/Platinum tier, lifetime spend > $1,200', computed: true },
      { name: 'At-Risk Members', count: Number(atRisk.rows[0]?.count ?? 0), desc: 'Ollama-flagged high/critical churn risk', computed: true },
      { name: 'Win-Back Candidates', count: Number(winBack.rows[0]?.count ?? 0), desc: 'Lapsed > 60 days, previously Gold+', computed: true },
      { name: 'Corporate Prospects', count: Number(corporate.rows[0]?.count ?? 0), desc: 'LinkedIn leads, not yet converted', computed: true },
    ],
    // Admin-defined custom segments — criteria are stored but not yet evaluated
    // against real customer data by any job, so the count is honestly reported
    // as not computed rather than shown as a live 0.
    customSegments: custom.rows.map(r => ({
      id: r.id, name: r.name, desc: r.description,
      computed: r.last_computed_at !== null, count: r.last_computed_at !== null ? r.estimated_size : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; description?: string; criteria?: SegmentCriteria[]; logic?: SegmentLogic;
  } | null;
  if (!body?.name || !body.criteria?.length) {
    return Response.json({ error: 'name and at least one criterion are required.' }, { status: 400 });
  }

  try {
    new AudienceSegment({
      id: '00000000-0000-0000-0000-000000000000', name: body.name, description: body.description ?? '',
      criteria: body.criteria, logic: body.logic ?? 'AND', estimatedSize: 0, isDynamic: true,
      createdById: principal!.id, createdAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid segment.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO audience_segment (tenant_id, name, description, criteria, logic, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, body.name, body.description ?? '', JSON.stringify(body.criteria), body.logic ?? 'AND', principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
