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
      const [ownerRes, petsRes, apptsRes] = await Promise.all([
        client.query(`SELECT * FROM vet_owner WHERE id=$1`, [id]),
        client.query(`SELECT * FROM vet_patient WHERE owner_id=$1 ORDER BY name`, [id]),
        client.query(`SELECT a.*, p.name AS patient_name, p.species FROM vet_appointment a LEFT JOIN vet_patient p ON p.id=a.patient_id WHERE a.owner_id=$1 ORDER BY a.scheduled_at DESC LIMIT 20`, [id]),
      ]);
      if (!ownerRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...ownerRes.rows[0], pets: petsRes.rows, appointments: apptsRes.rows });
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
    const fields = ['first_name','last_name','email','phone','address','city','province','preferred_contact'];
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
      const { rows } = await client.query(`UPDATE vet_owner SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
