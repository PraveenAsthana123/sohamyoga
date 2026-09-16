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
    const petRes = await client.query(
      `SELECT p.*, o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_pet p LEFT JOIN pg_owner o ON p.owner_id = o.id WHERE p.id = $1`,
      [params.id]
    );
    if (!petRes.rows.length) return Response.json({ error: 'Pet not found' }, { status: 404 });
    const appointments = await client.query(
      `SELECT * FROM pg_appointment WHERE pet_id = $1 ORDER BY scheduled_at DESC LIMIT 20`,
      [params.id]
    );
    return Response.json({ pet: petRes.rows[0], appointment_history: appointments.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['name','species','breed','color','date_of_birth','sex','weight_kg','spayed_neutered','vaccination_status','rabies_expiry','bordetella_expiry','distemper_expiry','behavioural_notes','grooming_notes','allergies','last_visit'];
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
      `UPDATE pg_pet SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Pet not found' }, { status: 404 });
    return Response.json({ pet: result.rows[0] });
  } finally {
    client.release();
  }
}
