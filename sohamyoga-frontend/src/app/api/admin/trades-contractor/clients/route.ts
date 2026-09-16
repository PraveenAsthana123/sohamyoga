import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const client_type = searchParams.get('client_type');
    const city = searchParams.get('city');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (client_type) { values.push(client_type); conditions.push(`c.client_type = $${values.length}`); }
      if (city) { values.push(`%${city}%`); conditions.push(`c.city ILIKE $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(
        `SELECT c.*, COUNT(j.id) AS job_count, COALESCE(SUM(j.paid_amount),0) AS total_spend, MAX(j.created_at) AS last_job
         FROM trade_client c LEFT JOIN trade_job j ON j.client_id = c.id
         ${where} GROUP BY c.id ORDER BY c.name`,
        values
      );
      return Response.json(rows);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `INSERT INTO trade_client (name,email,phone,address,city,province,client_type,source,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [body.name,body.email,body.phone,body.address,body.city||'Calgary',body.province||'AB',body.client_type||'residential',body.source,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
