import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT a.*, p.name AS pet_name, p.species, p.breed,
              o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_appointment a
       LEFT JOIN pg_pet p ON a.pet_id = p.id
       LEFT JOIN pg_owner o ON a.owner_id = o.id
       WHERE a.id = $1`,
      [params.id]
    );
    if (!result.rows.length) return Response.json({ error: 'Appointment not found' }, { status: 404 });
    return Response.json({ appointment: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['status','groomer','groomer_notes','before_photo_url','after_photo_url','owner_rating','duration_minutes'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
  }
  if (!updates.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  values.push(params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE pg_appointment SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Appointment not found' }, { status: 404 });
    return Response.json({ appointment: result.rows[0] });
  } finally {
    client.release();
  }
}
