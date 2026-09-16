import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM spa_client
        WHERE ($1='' OR first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
        ORDER BY last_name, first_name
      `, [`%${search}%`]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO spa_client (first_name, last_name, email, phone, date_of_birth, health_conditions, medications, allergies, contraindications, pressure_preference, preferred_therapist, referral_source, intake_form_signed, intake_form_date, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
      `, [
        body.first_name, body.last_name, body.email, body.phone,
        body.date_of_birth || null,
        body.health_conditions || [],
        body.medications || [],
        body.allergies || [],
        body.contraindications || null,
        body.pressure_preference || 'medium',
        body.preferred_therapist || null,
        body.referral_source || null,
        body.intake_form_signed || false,
        body.intake_form_signed ? new Date().toISOString().split('T')[0] : null,
        body.notes || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
