import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const id = parseInt(params.id, 10);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [clientRes, schedRes, notesRes] = await Promise.all([
        client.query(`SELECT *, DATE_PART('year', AGE(date_of_birth)) AS age FROM sc_client WHERE id=$1`, [id]),
        client.query(`SELECT s.*, cg.first_name AS cg_first, cg.last_name AS cg_last FROM sc_schedule s LEFT JOIN sc_caregiver cg ON cg.id=s.caregiver_id WHERE s.client_id=$1 ORDER BY s.visit_date DESC LIMIT 20`, [id]),
        client.query(`SELECT cn.*, cg.first_name AS cg_first, cg.last_name AS cg_last FROM sc_care_note cn LEFT JOIN sc_caregiver cg ON cg.id=cn.caregiver_id WHERE cn.client_id=$1 ORDER BY cn.visit_date DESC LIMIT 10`, [id]),
      ]);
      if (!clientRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...clientRes.rows[0], schedule_history: schedRes.rows, care_notes: notesRes.rows });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const id = parseInt(params.id, 10);
    const fields = ['first_name','last_name','date_of_birth','phone','address','city','province','postal_code','care_level','primary_condition','physician_name','physician_phone','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','preferred_language','aish_recipient','alberta_seniors_benefit','status','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(id);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`UPDATE sc_client SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
