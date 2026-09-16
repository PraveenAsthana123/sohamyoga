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
      SELECT s.*, g.first_name || ' ' || g.last_name AS guard_name, c.company_name
      FROM sec_shift s
      LEFT JOIN sec_guard g ON g.id = s.guard_id
      LEFT JOIN sec_client c ON c.id = s.client_id
      WHERE s.id = $1
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

    if (action === 'check_in') {
      const { rows } = await client.query(
        `UPDATE sec_shift SET status = 'in_progress', check_in_time = $2 WHERE id = $1 RETURNING *`,
        [params.id, body.check_in_time]
      );
      return NextResponse.json(rows[0]);
    }
    if (action === 'check_out') {
      const { rows } = await client.query(
        `UPDATE sec_shift SET check_out_time = $2, status = 'completed' WHERE id = $1 RETURNING *`,
        [params.id, body.check_out_time]
      );
      return NextResponse.json(rows[0]);
    }
    if (action === 'missed') {
      const { rows } = await client.query(
        `UPDATE sec_shift SET status = 'missed' WHERE id = $1 RETURNING *`, [params.id]
      );
      return NextResponse.json(rows[0]);
    }
    if (action === 'cancel') {
      const { rows } = await client.query(
        `UPDATE sec_shift SET status = 'cancelled' WHERE id = $1 RETURNING *`, [params.id]
      );
      return NextResponse.json(rows[0]);
    }

    // Generic field update
    const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'action');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE sec_shift SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
