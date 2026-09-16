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
      SELECT i.*, c.company_name, g.first_name || ' ' || g.last_name AS guard_name
      FROM sec_incident i
      LEFT JOIN sec_client c ON c.id = i.client_id
      LEFT JOIN sec_guard g ON g.id = i.guard_id
      WHERE i.id = $1
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

    if (action === 'submit_report') {
      const { rows } = await client.query(
        `UPDATE sec_incident SET report_submitted = true WHERE id = $1 RETURNING *`, [params.id]
      );
      return NextResponse.json(rows[0]);
    }
    if (action === 'add_followup') {
      const { rows } = await client.query(
        `UPDATE sec_incident SET follow_up_notes = $2, follow_up_required = true WHERE id = $1 RETURNING *`,
        [params.id, body.follow_up_notes]
      );
      return NextResponse.json(rows[0]);
    }

    const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'action');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE sec_incident SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
