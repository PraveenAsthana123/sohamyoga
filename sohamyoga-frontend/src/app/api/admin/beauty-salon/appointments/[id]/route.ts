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
      const { rows } = await client.query(`
        SELECT sa.*, sc.first_name, sc.last_name, sc.phone, sc.email,
               ss.name AS service_name, ss.category, ss.duration_minutes
        FROM salon_appointment sa
        LEFT JOIN salon_client sc ON sc.id=sa.client_id
        LEFT JOIN salon_service ss ON ss.id=sa.service_id
        WHERE sa.id=$1
      `, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ appointment: rows[0] });
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
      const fields = ['status','notes','stylist','appointment_at'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) { if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); } }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE salon_appointment SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ appointment: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
