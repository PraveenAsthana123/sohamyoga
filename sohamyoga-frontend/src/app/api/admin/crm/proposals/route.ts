import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proposal Management -- "proposal" previously existed only as a
// campaign_lead.funnel_stage string literal with nothing real behind it.
// See src/domain/marketing/db-schema-proposal.sql.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT p.id, p.title, p.amount, p.currency, p.status, p.valid_until, p.notes,
            p.sent_at, p.decided_at, p.created_at,
            l.first_name, l.last_name, l.email AS lead_email,
            (c.id IS NOT NULL) AS has_contract
     FROM proposal p
     JOIN campaign_lead l ON l.id = p.lead_id
     LEFT JOIN contract c ON c.proposal_id = p.id
     WHERE p.tenant_id = $1 ORDER BY p.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    proposals: rows.rows.map(r => ({
      id: r.id, title: r.title, amount: Number(r.amount), currency: r.currency, status: r.status,
      validUntil: r.valid_until, notes: r.notes, sentAt: r.sent_at, decidedAt: r.decided_at, createdAt: r.created_at,
      leadName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.lead_email, leadEmail: r.lead_email,
      hasContract: r.has_contract,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    leadId?: string; title?: string; amount?: number; currency?: string; validUntil?: string; notes?: string; listPrice?: number;
  } | null;
  if (!body?.leadId || !body.title || body.amount == null) {
    return Response.json({ error: 'leadId, title, and amount are required.' }, { status: 400 });
  }
  if (body.amount < 0) return Response.json({ error: 'amount cannot be negative.' }, { status: 400 });
  if (body.listPrice != null && body.listPrice < body.amount) {
    return Response.json({ error: 'listPrice cannot be less than amount.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO proposal (tenant_id, lead_id, title, amount, currency, valid_until, notes, created_by, list_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [tenantId, body.leadId, body.title, body.amount, body.currency ?? 'CAD', body.validUntil ?? null, body.notes ?? null, principal!.email ?? principal!.id, body.listPrice ?? null],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
