import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: [row] } = await client.query(
      `SELECT t.*, p.first_name, p.last_name, p.chief_complaint, p.tcm_constitution, p.mva_claim_number, p.extended_health_provider
       FROM tcm_treatment t JOIN tcm_patient p ON p.id = t.patient_id WHERE t.id = $1`,
      [params.id]
    );
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const allowed = ['status','practitioner','treatment_date','treatment_time','treatment_type','fee','patient_paid','payment_method','mva_claimed','extended_health_claimed'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE tcm_treatment SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
