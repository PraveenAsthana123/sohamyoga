import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const conditions: string[] = [];
    const vals: unknown[] = [];
    const addFilter = (col: string, param: string) => {
      const v = searchParams.get(param);
      if (v) { conditions.push(`c.${col}=$${vals.length + 1}`); vals.push(v); }
    };
    addFilter('claim_type', 'claim_type');
    addFilter('status', 'status');
    addFilter('adjuster_id', 'adjuster_id');
    addFilter('insurer_name', 'insurer');
    addFilter('priority', 'priority');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    if (dateFrom) { conditions.push(`c.loss_date>=$${vals.length + 1}`); vals.push(dateFrom); }
    if (dateTo) { conditions.push(`c.loss_date<=$${vals.length + 1}`); vals.push(dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT c.*, a.name AS adjuster_name
       FROM adj_claims c
       LEFT JOIN adj_adjusters a ON a.id = c.adjuster_id
       ${where} ORDER BY c.created_at DESC`,
      vals
    );
    return Response.json({ claims: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.claim_number || !body?.insurer_name || !body?.insured_name) {
    return Response.json({ error: 'claim_number, insurer_name, insured_name required.' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO adj_claims (claim_number, insurer_name, insurer_file_number, insured_name, insured_phone, insured_email, loss_address, loss_date, report_date, claim_type, cause_of_loss, policy_number, deductible_amount, coverage_limit, reserve_amount, status, priority, adjuster_id, insurer_contact_name, insurer_contact_email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [body.claim_number, body.insurer_name, body.insurer_file_number, body.insured_name, body.insured_phone, body.insured_email, body.loss_address, body.loss_date, body.report_date ?? new Date().toISOString().slice(0,10), body.claim_type ?? 'property', body.cause_of_loss, body.policy_number, body.deductible_amount ?? 0, body.coverage_limit, body.reserve_amount ?? 0, body.status ?? 'new', body.priority ?? 'standard', body.adjuster_id, body.insurer_contact_name, body.insurer_contact_email, body.notes]
    );
    return Response.json({ claim: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
