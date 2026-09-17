import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM pc_chemicals WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Chemical not found.' }, { status: 404 });
    return Response.json({ chemical: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'No body.' }, { status: 400 });

    // Special case: adjust_quantity delta
    if ('adjust_quantity' in b) {
      const delta = Number(b.adjust_quantity);
      if (isNaN(delta)) return Response.json({ error: 'adjust_quantity must be a number.' }, { status: 400 });
      const { rows } = await client.query(
        `UPDATE pc_chemicals SET quantity_on_hand = quantity_on_hand + $1 WHERE id = $2 RETURNING *`,
        [delta, params.id]
      );
      if (!rows.length) return Response.json({ error: 'Chemical not found.' }, { status: 404 });
      return Response.json({ chemical: rows[0] });
    }

    const allowed = ['product_name','pcpa_reg_number','active_ingredient','formulation_type','target_pests','restricted_use','quantity_on_hand','unit','reorder_threshold','cost_per_unit','expiry_date','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in b) { sets.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(
      `UPDATE pc_chemicals SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    return Response.json({ chemical: rows[0] });
  } finally {
    client.release();
  }
}
