import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['name','brand','category','sku','cost_price','retail_price','stock_quantity','reorder_level'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); } }
      // Support delta adjustments
      if (body.stock_delta !== undefined) { vals.push(body.stock_delta); sets.push(`stock_quantity = stock_quantity + $${vals.length}`); }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE salon_product SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ product: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
