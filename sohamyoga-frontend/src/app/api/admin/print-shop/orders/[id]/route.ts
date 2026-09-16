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
      SELECT o.*, c.first_name || ' ' || c.last_name AS customer_name, c.company, c.email AS customer_email, c.phone AS customer_phone
      FROM ps_order o LEFT JOIN ps_customer c ON c.id = o.customer_id
      WHERE o.id = $1
    `, [params.id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: files } = await client.query(`SELECT * FROM ps_design_file WHERE order_id = $1 ORDER BY version DESC, uploaded_at DESC`, [params.id]);
    return NextResponse.json({ ...rows[0], design_files: files });
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
    const { rows } = await client.query(`UPDATE ps_order SET ${sets} WHERE id = $1 RETURNING *`, [params.id, ...vals]);
    return NextResponse.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE ps_order SET status = 'cancelled' WHERE id = $1`, [params.id]);
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
