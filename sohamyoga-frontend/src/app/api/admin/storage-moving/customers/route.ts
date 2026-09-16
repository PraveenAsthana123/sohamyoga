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
    const type = searchParams.get('type') ?? '';
    const search = searchParams.get('search') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (type) { vals.push(type); where += ` AND customer_type = $${vals.length}`; }
    if (search) { vals.push(`%${search}%`); where += ` AND (first_name ILIKE $${vals.length} OR last_name ILIKE $${vals.length} OR email ILIKE $${vals.length} OR phone ILIKE $${vals.length})`; }
    const { rows } = await client.query(`SELECT * FROM sm_customer ${where} ORDER BY created_at DESC LIMIT 200`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO sm_customer (first_name, last_name, email, phone, current_address, new_address, city, province, referral_source, customer_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.current_address ?? null, b.new_address ?? null, b.city ?? 'Calgary', b.province ?? 'AB', b.referral_source ?? null, b.customer_type ?? 'residential', b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
