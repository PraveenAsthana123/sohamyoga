import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [proj, items] = await Promise.all([
        client.query(`SELECT p.*, c.first_name, c.last_name, c.email AS client_email FROM id_project p LEFT JOIN id_client c ON c.id = p.client_id WHERE p.id = $1`, [params.id]),
        client.query(`SELECT * FROM id_item WHERE project_id = $1 ORDER BY room, category`, [params.id]),
      ]);
      if (!proj.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      // Group items by room
      const itemsByRoom: Record<string, unknown[]> = {};
      for (const item of items.rows) {
        if (!itemsByRoom[item.room]) itemsByRoom[item.room] = [];
        itemsByRoom[item.room].push(item);
      }
      // Budget summary
      const specified = items.rows.reduce((s: number, i: { status: string; unit_retail: number; quantity: number }) => s + (i.status !== 'returned' ? (i.unit_retail ?? 0) * (i.quantity ?? 1) : 0), 0);
      const ordered = items.rows.reduce((s: number, i: { status: string; unit_retail: number; quantity: number }) => s + (['ordered','on_backorder','received','installed'].includes(i.status) ? (i.unit_retail ?? 0) * (i.quantity ?? 1) : 0), 0);
      const received = items.rows.reduce((s: number, i: { status: string; unit_retail: number; quantity: number }) => s + (['received','installed'].includes(i.status) ? (i.unit_retail ?? 0) * (i.quantity ?? 1) : 0), 0);
      return Response.json({ ...proj.rows[0], items: items.rows, items_by_room: itemsByRoom, budget_summary: { specified, ordered, received } });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['status','budget_actual','total_fee','deposit_paid','budget_furniture','start_date','completion_date','style','designer','mood_board_url','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = $${vals.length + 1}`); vals.push(body[f]); }
      }
      if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE id_project SET ${sets.join(',')} WHERE id = $${vals.length} RETURNING *`, vals);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
