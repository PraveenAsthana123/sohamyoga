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
      const [clientRes, apptRes] = await Promise.all([
        client.query(`SELECT * FROM salon_client WHERE id=$1`, [params.id]),
        client.query(`SELECT sa.*, ss.name AS service_name, ss.category FROM salon_appointment sa LEFT JOIN salon_service ss ON ss.id=sa.service_id WHERE sa.client_id=$1 ORDER BY sa.appointment_at DESC LIMIT 20`, [params.id]),
      ]);
      if (!clientRes.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ client: clientRes.rows[0], appointments: apptRes.rows });
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
      const fields = ['first_name','last_name','phone','email','date_of_birth','preferred_stylist','skin_type','hair_type','allergies','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); } }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE salon_client SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ client: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
