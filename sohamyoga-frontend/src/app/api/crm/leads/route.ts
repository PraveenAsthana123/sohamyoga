import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { findDuplicateLead, markAsDuplicate } from '@/domain/marketing/LeadDedup';

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
    lead_temperature: string | null; lead_score_reason: string | null; created_at: string; duplicate_of_lead_id: string | null;
  }>(
    `SELECT id, first_name, last_name, email, source_platform, funnel_stage,
            lead_score, lead_temperature, lead_score_reason, created_at, duplicate_of_lead_id
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
      scoreReason: r.lead_score_reason,
      added: r.created_at,
      duplicateOfLeadId: r.duplicate_of_lead_id,
    })),
  });
}

// POST /api/crm/leads — manual lead entry from the admin "+ Add Lead" button,
// previously a dead placeholder with no onClick handler at all. Runs through
// the same real dedup as every other lead-creation entry point.
export async function POST(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { name?: string; email?: string; phone?: string } | null;
  if (!body?.name?.trim() || !body.email?.trim()) {
    return Response.json({ error: 'name and email are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const nameParts = body.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || null;

  const result = await query<{ id: string }>(
    `INSERT INTO campaign_lead (tenant_id, first_name, last_name, email, phone, source_platform, funnel_stage)
     VALUES ($1,$2,$3,$4,$5,'manual_admin_entry','new') RETURNING id`,
    [tenantId, firstName, lastName, body.email.trim(), body.phone?.trim() || null],
  );

  const found = await findDuplicateLead(tenantId, body.email.trim());
  const duplicateOf = found && found !== result.rows[0].id ? found : null;
  if (duplicateOf) await markAsDuplicate(result.rows[0].id, duplicateOf);

  return Response.json({ ok: true, id: result.rows[0].id, duplicateOfLeadId: duplicateOf }, { status: 201 });
}
