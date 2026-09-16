import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const policy_type = searchParams.get('policy_type');
  const insurer = searchParams.get('insurer');
  const status = searchParams.get('status');
  const expiring_soon = searchParams.get('expiring_soon');
  const client_id = searchParams.get('client_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (policy_type && policy_type !== 'all') { conditions.push(`p.policy_type = $${idx++}`); params.push(policy_type); }
  if (insurer) { conditions.push(`p.insurer ILIKE $${idx++}`); params.push(`%${insurer}%`); }
  if (status) { conditions.push(`p.status = $${idx++}`); params.push(status); }
  if (client_id) { conditions.push(`p.client_id = $${idx++}`); params.push(parseInt(client_id, 10)); }
  if (expiring_soon === '1') {
    conditions.push(`p.status = 'active' AND p.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.*, ic.name AS client_name, ic.phone AS client_phone, ic.email AS client_email,
        (p.expiry_date - CURRENT_DATE) AS days_to_expiry
      FROM insurance_policy p
      JOIN insurance_client ic ON ic.id = p.client_id
      ${where}
      ORDER BY p.expiry_date ASC NULLS LAST, p.created_at DESC
      LIMIT 500
    `, params);
    return Response.json({ policies: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id || !b.policy_type || !b.insurer) {
    return Response.json({ error: 'client_id, policy_type, and insurer are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO insurance_policy
        (client_id, policy_type, insurer, policy_number, coverage_amount, annual_premium,
         monthly_premium, deductible, effective_date, expiry_date, status,
         coverage_details, broker_commission_pct, broker_commission_amt, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      b.client_id, b.policy_type, b.insurer, b.policy_number || null,
      b.coverage_amount || null, b.annual_premium || null, b.monthly_premium || null,
      b.deductible || null, b.effective_date || null, b.expiry_date || null,
      b.status || 'quoted', JSON.stringify(b.coverage_details || {}),
      b.broker_commission_pct || null, b.broker_commission_amt || null, b.notes || null,
    ]);
    return Response.json({ policy: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
