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
    const ownerRes = await client.query(`SELECT * FROM pg_owner WHERE id = $1`, [params.id]);
    if (!ownerRes.rows.length) return Response.json({ error: 'Owner not found' }, { status: 404 });
    const pets = await client.query(`SELECT * FROM pg_pet WHERE owner_id = $1 ORDER BY name`, [params.id]);
    const appointments = await client.query(
      `SELECT a.*, p.name AS pet_name FROM pg_appointment a
       LEFT JOIN pg_pet p ON a.pet_id = p.id
       WHERE a.owner_id = $1 ORDER BY a.scheduled_at DESC LIMIT 20`,
      [params.id]
    );
    return Response.json({ owner: ownerRes.rows[0], pets: pets.rows, appointment_history: appointments.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['first_name','last_name','phone','email','address','emergency_contact_name','emergency_contact_phone','vet_name','vet_phone','vet_clinic','notes'];
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
      `UPDATE pg_owner SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Owner not found' }, { status: 404 });
    return Response.json({ owner: result.rows[0] });
  } finally {
    client.release();
  }
}
