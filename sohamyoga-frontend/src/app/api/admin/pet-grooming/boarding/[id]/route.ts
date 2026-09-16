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
      `SELECT b.*, p.name AS pet_name, p.species, p.breed, p.behavioural_notes, p.allergies,
              o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_boarding b
       LEFT JOIN pg_pet p ON b.pet_id = p.id
       LEFT JOIN pg_owner o ON b.owner_id = o.id
       WHERE b.id = $1`,
      [params.id]
    );
    if (!result.rows.length) return Response.json({ error: 'Boarding record not found' }, { status: 404 });
    return Response.json({ boarding: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { action } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    let result;
    if (action === 'check_in') {
      result = await client.query(
        `UPDATE pg_boarding SET status = 'checked_in' WHERE id = $1 RETURNING *`,
        [params.id]
      );
    } else if (action === 'check_out') {
      result = await client.query(
        `UPDATE pg_boarding SET status = 'checked_out' WHERE id = $1 RETURNING *`,
        [params.id]
      );
    } else {
      const allowed = ['kennel_number','daily_rate','feeding_instructions','medication_instructions','exercise_level','special_requests','status','total_amount'];
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
      }
      if (!updates.length) return Response.json({ error: 'No valid action or fields' }, { status: 400 });
      values.push(params.id);
      result = await client.query(
        `UPDATE pg_boarding SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
    }
    if (!result.rows.length) return Response.json({ error: 'Boarding record not found' }, { status: 404 });
    return Response.json({ boarding: result.rows[0] });
  } finally {
    client.release();
  }
}
