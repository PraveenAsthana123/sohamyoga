import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT j.*, c.first_name || ' ' || c.last_name AS client_name, c.address, c.dog_on_property, c.gate_code, c.special_notes AS client_notes
      FROM ls_job j LEFT JOIN ls_client c ON c.id = j.client_id WHERE j.id = $1
    `, [params.id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { action } = body;
    const STATUS_ACTIONS: Record<string, string> = { en_route: 'en_route', start: 'in_progress', weather_hold: 'weather_hold', cancel: 'cancelled' };
    if (action && STATUS_ACTIONS[action]) {
      const { rows } = await client.query(`UPDATE ls_job SET status = $2 WHERE id = $1 RETURNING *`, [params.id, STATUS_ACTIONS[action]]);
      return NextResponse.json(rows[0]);
    }
    const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'action');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ls_job SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
