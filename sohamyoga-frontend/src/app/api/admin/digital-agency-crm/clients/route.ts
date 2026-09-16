import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const manager = searchParams.get('account_manager');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push(`status=$${params.length + 1}`); params.push(status); }
    if (manager) { conditions.push(`account_manager=$${params.length + 1}`); params.push(manager); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT *, DATE_PART('day', contract_end - CURRENT_DATE) AS days_to_renewal
       FROM dac_client ${where} ORDER BY churn_risk_score DESC, company_name`,
      params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO dac_client (company_name, industry, contact_name, contact_email, contact_phone, city, province, client_type, monthly_retainer, annual_value, services, account_manager, contract_start, contract_end, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [body.company_name, body.industry, body.contact_name, body.contact_email, body.contact_phone,
       body.city || 'Calgary', body.province || 'AB', body.client_type || 'retainer',
       body.monthly_retainer || null, body.annual_value || null,
       body.services || ['seo'], body.account_manager,
       body.contract_start || null, body.contract_end || null,
       body.status || 'active', body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
