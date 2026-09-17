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
    const customer_id = searchParams.get('customer_id');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`a.status = $${idx++}`); vals.push(status); }
    if (customer_id) { conditions.push(`a.customer_id = $${idx++}`); vals.push(customer_id); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT a.*, c.name AS customer_name, c.address AS customer_address
       FROM pc_service_agreements a
       LEFT JOIN pc_customers c ON c.id = a.customer_id
       ${where}
       ORDER BY a.renewal_date ASC NULLS LAST`,
      vals
    );
    return Response.json({ agreements: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b?.customer_id || !b?.plan_name) return Response.json({ error: 'customer_id and plan_name are required.' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO pc_service_agreements (customer_id, plan_name, frequency, services_included, price_per_visit, annual_value, start_date, renewal_date, status, auto_renew, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.customer_id, b.plan_name, b.frequency ?? null, b.services_included ?? null, b.price_per_visit ?? null, b.annual_value ?? null, b.start_date ?? null, b.renewal_date ?? null, b.status ?? 'active', b.auto_renew ?? true, b.notes ?? null]
    );
    return Response.json({ agreement: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
