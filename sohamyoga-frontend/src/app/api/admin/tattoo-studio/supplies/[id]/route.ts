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
    const { rows } = await client.query('SELECT * FROM ts_supply WHERE id = $1', [params.id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ supply: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Special: adjust quantity by delta
    if (body.adjust_quantity !== undefined) {
      const { rows } = await client.query(
        `UPDATE ts_supply SET quantity_on_hand = quantity_on_hand + $1 WHERE id = $2 RETURNING *`,
        [body.adjust_quantity, params.id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ supply: rows[0] });
    }

    const fields = ['name','category','brand','quantity_on_hand','unit','reorder_point',
      'cost_per_unit','supplier','is_sterile_single_use','expiry_date'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); values.push(body[f]); }
    }

    if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    values.push(params.id);

    const { rows } = await client.query(
      `UPDATE ts_supply SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ supply: rows[0] });
  } finally {
    client.release();
  }
}
