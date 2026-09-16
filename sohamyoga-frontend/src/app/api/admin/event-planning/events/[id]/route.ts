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
      const [eventRes, vendorsRes, tasksRes, timelineRes] = await Promise.all([
        client.query(`SELECT * FROM ep_event WHERE id=$1`, [params.id]),
        client.query(`SELECT * FROM ep_vendor WHERE event_id=$1 ORDER BY vendor_type, vendor_name`, [params.id]),
        client.query(`SELECT * FROM ep_task WHERE event_id=$1 ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, due_date NULLS LAST`, [params.id]),
        client.query(`SELECT * FROM ep_timeline WHERE event_id=$1 ORDER BY time_slot`, [params.id]),
      ]);
      if (!eventRes.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ event: eventRes.rows[0], vendors: vendorsRes.rows, tasks: tasksRes.rows, timeline: timelineRes.rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
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
      const fields = ['name','event_type','client_name','client_email','client_phone','event_date','event_time','venue','venue_address','guest_count','budget','status','theme','catering','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); } }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE ep_event SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ event: rows[0] });
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
      await client.query(`DELETE FROM ep_event WHERE id=$1`, [params.id]);
      return Response.json({ success: true });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
