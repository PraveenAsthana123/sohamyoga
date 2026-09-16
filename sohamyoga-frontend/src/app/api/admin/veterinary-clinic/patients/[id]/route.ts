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
      const [patRes, apptsRes, vaccsRes, rxRes] = await Promise.all([
        client.query(`SELECT p.*, o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone, DATE_PART('year', AGE(p.date_of_birth)) AS age_years FROM vet_patient p LEFT JOIN vet_owner o ON o.id=p.owner_id WHERE p.id=$1`, [id]),
        client.query(`SELECT * FROM vet_appointment WHERE patient_id=$1 ORDER BY scheduled_at DESC LIMIT 20`, [id]),
        client.query(`SELECT * FROM vet_vaccination WHERE patient_id=$1 ORDER BY administered_date DESC`, [id]),
        client.query(`SELECT * FROM vet_prescription WHERE patient_id=$1 ORDER BY prescribed_date DESC`, [id]),
      ]);
      if (!patRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...patRes.rows[0], appointments: apptsRes.rows, vaccinations: vaccsRes.rows, prescriptions: rxRes.rows });
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
    const fields = ['name','species','breed','color','date_of_birth','sex','spayed_neutered','microchip_number','weight_kg','insurance_provider','insurance_policy','allergies','current_medications','status'];
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
      const { rows } = await client.query(`UPDATE vet_patient SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
