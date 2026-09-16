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
      const fields = ['name','description','instructor','class_type','capacity','duration_minutes','schedule_days','schedule_time','location','price_drop_in','is_active'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
      }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE gym_class SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ class: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`UPDATE gym_class SET is_active=false WHERE id=$1`, [params.id]);
      return Response.json({ success: true, action: 'deactivated' });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
