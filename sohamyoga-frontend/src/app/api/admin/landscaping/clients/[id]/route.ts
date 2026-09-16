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
    const { rows: clientRows } = await client.query(`SELECT * FROM ls_client WHERE id = $1`, [params.id]);
    if (!clientRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: jobs } = await client.query(`SELECT * FROM ls_job WHERE client_id = $1 ORDER BY job_date DESC LIMIT 20`, [params.id]);
    return NextResponse.json({ ...clientRows[0], job_history: jobs });
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
    const { rows } = await client.query(`UPDATE ls_client SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
