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
      const { rows } = await client.query(`
        SELECT *, (CURRENT_DATE - enrollment_date::DATE)::INT AS days_on_waitlist
        FROM cc_child WHERE status = 'waitlist' ORDER BY enrollment_date ASC
      `);
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
        `INSERT INTO cc_child (name, date_of_birth, age_group, parent1_name, parent1_email, parent1_phone, enrollment_date, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'waitlist',$8) RETURNING *`,
        [body.name, body.date_of_birth, body.age_group, body.parent1_name, body.parent1_email, body.parent1_phone,
         new Date().toISOString().split('T')[0], body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
