export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [patient, appointments, claims] = await Promise.all([
      client.query(`SELECT * FROM healthcare_patient WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM healthcare_appointment WHERE patient_id=$1 ORDER BY appointment_date DESC`, [params.id]),
      client.query(`SELECT * FROM healthcare_claim WHERE patient_id=$1 ORDER BY created_at DESC`, [params.id]),
    ]);

    if (!patient.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ patient: patient.rows[0], appointments: appointments.rows, claims: claims.rows });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const fields = ['name','email','phone','date_of_birth','health_card_number','province','alberta_health_number',
      'emergency_contact','emergency_phone','allergies','medications','conditions',
      'insurance_provider','insurance_policy_number','insurance_group_number',
      'status','preferred_provider','notes'];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);

    const r = await client.query(`UPDATE healthcare_patient SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ patient: r.rows[0] });
  } finally {
    client.release();
  }
}
