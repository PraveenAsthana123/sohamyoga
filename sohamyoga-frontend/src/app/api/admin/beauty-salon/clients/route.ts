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
    const search = searchParams.get('search') ?? '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (search) { params.push(`%${search}%`); where += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`; }
      const { rows } = await client.query(`SELECT * FROM salon_client ${where} ORDER BY last_visit DESC NULLS LAST, created_at DESC LIMIT 200`, params);
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { first_name, last_name, phone, email, date_of_birth, preferred_stylist, skin_type, hair_type, allergies, notes } = body;
    if (!first_name || !last_name || !phone) return Response.json({ error: 'first_name, last_name, phone required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO salon_client (first_name,last_name,phone,email,date_of_birth,preferred_stylist,skin_type,hair_type,allergies,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [first_name, last_name, phone, email ?? null, date_of_birth ?? null, preferred_stylist ?? null, skin_type ?? null, hair_type ?? null, allergies ?? null, notes ?? null]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
