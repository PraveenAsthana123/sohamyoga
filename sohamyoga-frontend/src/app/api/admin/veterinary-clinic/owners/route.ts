import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search');
      const vals: unknown[] = [];
      let where = '';
      if (search) { vals.push(`%${search}%`); where = `WHERE o.first_name ILIKE $1 OR o.last_name ILIKE $1 OR o.email ILIKE $1 OR o.phone ILIKE $1`; }
      const { rows } = await client.query(`
        SELECT o.*, COUNT(p.id) AS pet_count FROM vet_owner o
        LEFT JOIN vet_patient p ON p.owner_id=o.id AND p.status='active'
        ${where}
        GROUP BY o.id ORDER BY o.last_name
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { first_name, last_name, email, phone, address, city = 'Calgary', province = 'AB', preferred_contact = 'phone' } = body;
    if (!first_name || !last_name || !phone) return Response.json({ error: 'first_name, last_name, phone required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO vet_owner (first_name, last_name, email, phone, address, city, province, preferred_contact)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [first_name, last_name, email, phone, address, city, province, preferred_contact]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
