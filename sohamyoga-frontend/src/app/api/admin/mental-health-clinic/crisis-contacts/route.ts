import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const vals: unknown[] = [];
    const where = client_id ? `WHERE client_id = $1` : '';
    if (client_id) vals.push(client_id);
    const { rows } = await client.query(`SELECT * FROM mh_crisis_contact ${where} ORDER BY is_emergency_contact DESC, created_at ASC`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO mh_crisis_contact (client_id, contact_name, relationship, phone, is_emergency_contact, is_aware_of_treatment, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.client_id, b.contact_name, b.relationship, b.phone, b.is_emergency_contact ?? true, b.is_aware_of_treatment ?? false, b.notes || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
