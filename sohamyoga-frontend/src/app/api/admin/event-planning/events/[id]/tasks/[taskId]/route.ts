import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; taskId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['task_name','category','assigned_to','due_date','status','priority','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); } }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.taskId);
      const { rows } = await client.query(`UPDATE ep_task SET ${sets.join(',')} WHERE id=$${vals.length} AND event_id=${params.id} RETURNING *`, vals);
      return Response.json({ task: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; taskId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM ep_task WHERE id=$1 AND event_id=$2`, [params.taskId, params.id]);
      return Response.json({ success: true });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
