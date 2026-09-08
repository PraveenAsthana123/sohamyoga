import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Opportunity -- the missing link between Lead and Proposal. See
// src/domain/marketing/db-schema-opportunity.sql.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT o.id, o.title, o.estimated_value, o.currency, o.stage, o.probability_pct,
            o.expected_close_date, o.lost_reason, o.notes, o.created_at, o.closed_at,
            o.ai_score, o.ai_note, o.ai_assessed_at,
            l.first_name, l.last_name, l.email AS lead_email
     FROM opportunity o JOIN campaign_lead l ON l.id = o.lead_id
     WHERE o.tenant_id = $1 ORDER BY o.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    opportunities: rows.rows.map(r => ({
      id: r.id, title: r.title, estimatedValue: Number(r.estimated_value), currency: r.currency,
      stage: r.stage, probabilityPct: r.probability_pct, expectedCloseDate: r.expected_close_date,
      lostReason: r.lost_reason, notes: r.notes, createdAt: r.created_at, closedAt: r.closed_at,
      aiScore: r.ai_score, aiNote: r.ai_note, aiAssessedAt: r.ai_assessed_at,
      leadName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.lead_email, leadEmail: r.lead_email,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    leadId?: string; title?: string; estimatedValue?: number; probabilityPct?: number; expectedCloseDate?: string;
  } | null;
  if (!body?.leadId || !body.title || body.estimatedValue == null) {
    return Response.json({ error: 'leadId, title, and estimatedValue are required.' }, { status: 400 });
  }
  if (body.estimatedValue < 0) return Response.json({ error: 'estimatedValue cannot be negative.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO opportunity (tenant_id, lead_id, title, estimated_value, probability_pct, expected_close_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, body.leadId, body.title, body.estimatedValue, body.probabilityPct ?? null, body.expectedCloseDate ?? null, principal!.email ?? principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
