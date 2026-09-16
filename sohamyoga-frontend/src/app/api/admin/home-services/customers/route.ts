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
    const status = req.nextUrl.searchParams.get('status') ?? '';
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (search) { values.push(`%${search}%`); conditions.push(`(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length} OR phone ILIKE $${values.length} OR address ILIKE $${values.length})`); }
    if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(`SELECT * FROM hs_customer ${where} ORDER BY last_name, first_name LIMIT 200`, values);
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
      `INSERT INTO hs_customer (first_name,last_name,email,phone,address,city,province,postal_code,service_notes,gate_code,pet_info,alarm_code,preferred_team,referral_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.address, b.city ?? 'Calgary', b.province ?? 'AB', b.postal_code, b.service_notes, b.gate_code, b.pet_info, b.alarm_code, b.preferred_team, b.referral_source]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
