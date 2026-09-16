import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const row = await client.query(`SELECT *, quantity_on_hand <= reorder_threshold AS is_low_stock FROM pool_chemicals WHERE id = $1`, [params.id]);
    if (!row.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ chemical: row.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Special delta path for dispensing or restocking
    if (body.adjust_quantity !== undefined) {
      const row = await client.query(
        `UPDATE pool_chemicals SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1), updated_at = NOW() WHERE id = $2 RETURNING *`,
        [body.adjust_quantity, params.id]
      );
      if (!row.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ chemical: row.rows[0] });
    }

    const fields = ['name', 'category', 'unit', 'quantity_on_hand', 'reorder_threshold', 'cost_per_unit', 'supplier', 'health_canada_reg', 'notes'];
    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(body[f]); }
    }
    updates.push(`updated_at = NOW()`);
    if (updates.length === 1) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const row = await client.query(
      `UPDATE pool_chemicals SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ chemical: row.rows[0] });
  } finally {
    client.release();
  }
}
