import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Contract Management -- a real extension of the Proposal system
// (src/domain/marketing/db-schema-contract.sql). No e-signature service is
// connected in this environment; signing is a manual admin-recorded action.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT c.id, c.title, c.terms, c.amount, c.currency, c.status, c.signed_by_name,
            c.sent_at, c.signed_at, c.voided_at, c.created_at, c.proposal_id,
            l.first_name, l.last_name, l.email AS lead_email
     FROM contract c
     JOIN campaign_lead l ON l.id = c.lead_id
     WHERE c.tenant_id = $1 ORDER BY c.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    contracts: rows.rows.map(r => ({
      id: r.id, title: r.title, terms: r.terms, amount: Number(r.amount), currency: r.currency,
      status: r.status, signedByName: r.signed_by_name, sentAt: r.sent_at, signedAt: r.signed_at,
      voidedAt: r.voided_at, createdAt: r.created_at, proposalId: r.proposal_id,
      leadName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.lead_email, leadEmail: r.lead_email,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { proposalId?: string; title?: string; terms?: string } | null;
  if (!body?.proposalId || !body.title || !body.terms?.trim()) {
    return Response.json({ error: 'proposalId, title, and terms are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const proposal = await query<{ lead_id: string; amount: string; currency: string; status: string }>(
    `SELECT lead_id, amount, currency, status FROM proposal WHERE id = $1 AND tenant_id = $2`,
    [body.proposalId, tenantId],
  );
  if (!proposal.rowCount) return Response.json({ error: 'Proposal not found.' }, { status: 404 });
  if (proposal.rows[0].status !== 'accepted') {
    return Response.json({ error: 'A contract can only be created from an accepted proposal.' }, { status: 409 });
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO contract (tenant_id, proposal_id, lead_id, title, terms, amount, currency, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [tenantId, body.proposalId, proposal.rows[0].lead_id, body.title, body.terms.trim(),
        proposal.rows[0].amount, proposal.rows[0].currency, principal!.email ?? principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('contract_proposal_id_key')) {
      return Response.json({ error: 'A contract already exists for this proposal.' }, { status: 409 });
    }
    throw err;
  }
}
