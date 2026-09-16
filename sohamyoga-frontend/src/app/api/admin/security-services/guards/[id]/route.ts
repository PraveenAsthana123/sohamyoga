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
    const { rows: guardRows } = await client.query(
      `SELECT *, (license_expiry - CURRENT_DATE) AS license_days_remaining FROM sec_guard WHERE id = $1`, [params.id]
    );
    if (!guardRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: shifts } = await client.query(`
      SELECT s.*, c.company_name
      FROM sec_shift s LEFT JOIN sec_client c ON c.id = s.client_id
      WHERE s.guard_id = $1 AND s.shift_date >= CURRENT_DATE
      ORDER BY s.shift_date, s.start_time LIMIT 20
    `, [params.id]);
    return NextResponse.json({ ...guardRows[0], upcoming_shifts: shifts });
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
    const { rows } = await client.query(`UPDATE sec_guard SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
