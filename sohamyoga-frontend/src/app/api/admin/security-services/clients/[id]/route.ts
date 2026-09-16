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
    const { rows: clientRows } = await client.query(`SELECT * FROM sec_client WHERE id = $1`, [params.id]);
    if (!clientRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: shifts } = await client.query(`
      SELECT s.*, g.first_name || ' ' || g.last_name AS guard_name
      FROM sec_shift s LEFT JOIN sec_guard g ON g.id = s.guard_id
      WHERE s.client_id = $1 ORDER BY s.shift_date DESC, s.start_time DESC LIMIT 50
    `, [params.id]);
    const { rows: incidentCount } = await client.query(
      `SELECT COUNT(*) AS n FROM sec_incident WHERE client_id = $1`, [params.id]
    );
    return NextResponse.json({ ...clientRows[0], shifts, incident_count: parseInt(incidentCount[0].n) });
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
    const fields = Object.keys(body).filter(k => k !== 'id');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE sec_client SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
