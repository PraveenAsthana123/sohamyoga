import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const search = req.nextUrl.searchParams.get('search') ?? '';
    const type = req.nextUrl.searchParams.get('type') ?? '';
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (search) { values.push(`%${search}%`); conditions.push(`(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length} OR email ILIKE $${values.length} OR company ILIKE $${values.length})`); }
    if (type) { values.push(type); conditions.push(`client_type = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT c.*, (SELECT COUNT(*) FROM photo_shoot s WHERE s.client_id = c.id) AS shoot_count FROM photo_client c ${where} ORDER BY last_name, first_name LIMIT 200`,
      values
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO photo_client (first_name,last_name,email,phone,company,client_type,referral_source,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.company, b.client_type ?? 'individual', b.referral_source, b.notes]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
