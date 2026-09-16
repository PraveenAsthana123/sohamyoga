import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['room','item_name','category','supplier','model_sku','finish','dimensions','quantity','unit_cost','unit_retail','designer_markup_pct','status','lead_time_weeks','order_date','expected_delivery','received_date','notes','image_url'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.itemId);
      const { rows } = await client.query(`UPDATE id_item SET ${sets.join(',')} WHERE id = $${vals.length} AND project_id = ${params.id} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM id_item WHERE id = $1 AND project_id = $2`, [params.itemId, params.id]);
      return Response.json({ ok: true });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
