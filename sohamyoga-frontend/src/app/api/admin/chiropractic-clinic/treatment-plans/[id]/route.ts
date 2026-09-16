import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT tp.*, p.first_name, p.last_name FROM chiro_treatment_plan tp
       JOIN chiro_patient p ON p.id=tp.patient_id WHERE tp.id=$1`, [parseInt(params.id)]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    const allowed = ['status','diagnosis','treatment_frequency','proposed_visits','duration_weeks',
      'techniques','goals','mva_pre_authorized','wca_pre_authorized','auth_visits'];
    const fields = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([, v]) => v);
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const { rows } = await client.query(
      `UPDATE chiro_treatment_plan SET ${fields.join(',')} WHERE id=$1 RETURNING *`, [id, ...values]
    );
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
