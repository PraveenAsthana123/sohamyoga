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
    const { rows: custRows } = await client.query(`SELECT * FROM ps_customer WHERE id = $1`, [params.id]);
    if (!custRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: orders } = await client.query(
      `SELECT * FROM ps_order WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`, [params.id]
    );
    return NextResponse.json({ ...custRows[0], orders });
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
    const { rows } = await client.query(`UPDATE ps_customer SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}
