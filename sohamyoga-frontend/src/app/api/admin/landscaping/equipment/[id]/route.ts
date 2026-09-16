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
    const { rows } = await client.query(
      `SELECT *, (next_service_date - CURRENT_DATE) AS service_days_remaining FROM ls_equipment WHERE id = $1`, [params.id]
    );
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
    if (action === 'record_service') {
      const { rows } = await client.query(`
        UPDATE ls_equipment SET
          last_service_date = $2,
          next_service_date = $3,
          status = 'operational'
        WHERE id = $1 RETURNING *
      `, [params.id, body.service_date, body.next_service_date]);
      return NextResponse.json(rows[0]);
    }
    const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'action');
    if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ls_equipment SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
