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
    const category = searchParams.get('category');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (category) { values.push(category); conditions.push(`category = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(`SELECT * FROM rh_supplier ${where} ORDER BY name`, values);
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
        `INSERT INTO rh_supplier (name,category,contact_name,phone,email,payment_terms,delivery_days,min_order_amount,status,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [body.name,body.category,body.contact_name,body.phone,body.email,body.payment_terms||30,body.delivery_days||[],body.min_order_amount||null,body.status||'active',body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
