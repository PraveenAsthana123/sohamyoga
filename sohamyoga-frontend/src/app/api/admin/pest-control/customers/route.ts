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
    const account_type = searchParams.get('account_type');
    const search = searchParams.get('search');
    const conditions: string[] = ['c.is_active = true'];
    const vals: unknown[] = [];
    let idx = 1;
    if (account_type) { conditions.push(`c.account_type = $${idx++}`); vals.push(account_type); }
    if (search) { conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.address ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await client.query(
      `SELECT c.*, COUNT(j.id) AS job_count
       FROM pc_customers c
       LEFT JOIN pc_jobs j ON j.customer_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      vals
    );
    return Response.json({ customers: rows });
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
    if (!b?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO pc_customers (name, email, phone, address, property_type, account_type, service_plan, contract_start, contract_end, pet_on_property, medical_sensitivities, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.name, b.email ?? null, b.phone ?? null, b.address ?? null, b.property_type ?? null, b.account_type ?? 'one_time', b.service_plan ?? null, b.contract_start ?? null, b.contract_end ?? null, b.pet_on_property ?? false, b.medical_sensitivities ?? null, b.notes ?? null]
    );
    return Response.json({ customer: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
