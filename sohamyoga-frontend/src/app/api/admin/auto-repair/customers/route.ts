import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT c.*, COUNT(DISTINCT v.id) AS vehicle_count, COUNT(DISTINCT wo.id) AS work_order_count
      FROM ar_customer c
      LEFT JOIN ar_vehicle v ON v.customer_id = c.id
      LEFT JOIN ar_work_order wo ON wo.customer_id = c.id
      WHERE ($1 = '' OR c.first_name ILIKE $2 OR c.last_name ILIKE $2 OR c.phone ILIKE $2 OR c.email ILIKE $2)
      GROUP BY c.id ORDER BY c.last_name, c.first_name
    `, [q, `%${q}%`]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { first_name, last_name, email, phone, address, city, province, preferred_contact, notes } = body;
  if (!first_name || !last_name || !phone) return Response.json({ error: 'first_name, last_name, phone required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO ar_customer (first_name, last_name, email, phone, address, city, province, preferred_contact, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [first_name, last_name, email||null, phone, address||null, city||'Calgary', province||'AB', preferred_contact||'phone', notes||null]);
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
