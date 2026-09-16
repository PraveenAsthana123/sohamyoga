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
    const status = searchParams.get('status');
    const search = searchParams.get('search') ?? '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (status) { params.push(status); where += ` AND membership_status=$${params.length}`; }
      if (search) { params.push(`%${search}%`); where += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
      const { rows } = await client.query(
        `SELECT id, first_name, last_name, email, phone, membership_type, membership_status, start_date, expiry_date, health_waiver_signed, created_at FROM gym_member ${where} ORDER BY created_at DESC LIMIT 200`,
        params
      );
      return Response.json({ members: rows });
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
    const { first_name, last_name, email, phone, date_of_birth, membership_type = 'monthly', start_date, expiry_date, emergency_contact_name, emergency_contact_phone, health_waiver_signed = false, notes } = body;
    if (!first_name || !last_name || !email) return Response.json({ error: 'first_name, last_name, email required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO gym_member (first_name,last_name,email,phone,date_of_birth,membership_type,start_date,expiry_date,emergency_contact_name,emergency_contact_phone,health_waiver_signed,health_waiver_date,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [first_name, last_name, email, phone ?? null, date_of_birth ?? null, membership_type, start_date ?? null, expiry_date ?? null, emergency_contact_name ?? null, emergency_contact_phone ?? null, health_waiver_signed, health_waiver_signed ? new Date() : null, notes ?? null]
      );
      return Response.json({ member: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
