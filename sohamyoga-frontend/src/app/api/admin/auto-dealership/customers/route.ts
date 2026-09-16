import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const credit_tier = searchParams.get('credit_tier');
  const source = searchParams.get('source');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (credit_tier) { conds.push(`c.credit_tier = $${i++}`); vals.push(credit_tier); }
      if (source) { conds.push(`c.source = $${i++}`); vals.push(source); }
      if (status) { conds.push(`c.status = $${i++}`); vals.push(status); }
      if (search) { conds.push(`(LOWER(c.name) LIKE $${i} OR c.email LIKE $${i} OR c.phone LIKE $${i})`); vals.push(`%${search.toLowerCase()}%`); i++; }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT c.*, COUNT(d.id) AS deal_count
         FROM auto_customer c
         LEFT JOIN auto_deal d ON d.customer_id = c.id
         ${where} GROUP BY c.id ORDER BY c.created_at DESC`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
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
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO auto_customer (name, email, phone, address, city, province, date_of_birth, sin_last4,
          credit_tier, employment_type, annual_income, source, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [body.name, body.email, body.phone, body.address, body.city ?? 'Calgary',
         body.province ?? 'AB', body.date_of_birth, body.sin_last4,
         body.credit_tier, body.employment_type, body.annual_income,
         body.source, body.status ?? 'active', body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
