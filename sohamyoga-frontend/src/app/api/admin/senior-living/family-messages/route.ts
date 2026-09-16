import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const resident_id = searchParams.get('resident_id');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (resident_id) { conditions.push(`m.resident_id = $${idx++}`); vals.push(resident_id); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT m.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM sl_family_messages m JOIN sl_residents r ON r.id = m.resident_id
       ${where} ORDER BY m.created_at DESC LIMIT 100`, vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    if (!b.resident_id || !b.message_text) return Response.json({ error: 'resident_id and message_text required' }, { status: 400 });
    const { rows } = await client.query(`
      INSERT INTO sl_family_messages (resident_id, sender_role, sender_name, message_text, is_read)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.resident_id, b.sender_role || 'staff', b.sender_name, b.message_text, b.is_read || false]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
