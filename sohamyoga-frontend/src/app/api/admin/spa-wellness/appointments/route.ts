import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const therapist = searchParams.get('therapist') || '';
  const status = searchParams.get('status') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT a.*, c.first_name, c.last_name, c.phone, c.pressure_preference,
               c.health_conditions, c.contraindications,
               s.name AS service_name, s.category, s.duration_minutes, s.price
        FROM spa_appointment a
        LEFT JOIN spa_client c ON c.id=a.client_id
        LEFT JOIN spa_service s ON s.id=a.service_id
        WHERE ($1='' OR DATE(a.scheduled_at)=$1::date)
          AND ($2='' OR a.therapist ILIKE $2)
          AND ($3='' OR a.status=$3)
        ORDER BY a.scheduled_at ASC
      `, [date, `%${therapist}%`, status]);
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
        INSERT INTO spa_appointment (client_id, service_id, therapist, room, scheduled_at, intake_notes, massage_benefit_claimed)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [
        body.client_id, body.service_id, body.therapist,
        body.room || null, body.scheduled_at,
        body.intake_notes || null, body.massage_benefit_claimed || false,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
