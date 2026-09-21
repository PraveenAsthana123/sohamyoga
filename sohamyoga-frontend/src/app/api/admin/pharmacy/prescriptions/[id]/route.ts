import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const row = await client.query(
      `SELECT p.*, pat.first_name, pat.last_name, pat.allergies, pat.current_conditions
       FROM rx_prescription p JOIN rx_patient pat ON pat.id = p.patient_id WHERE p.id = $1`,
      [params.id]
    );
    if (!row.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE rx_prescription SET
        status=COALESCE($1,status),
        insurance_claim_status=COALESCE($2,insurance_claim_status),
        patient_cost=COALESCE($3,patient_cost),
        insurance_paid=COALESCE($4,insurance_paid),
        dispensed_by=COALESCE($5,dispensed_by)
       WHERE id=$6 RETURNING *`,
      [b.status, b.insurance_claim_status, b.patient_cost, b.insurance_paid, b.dispensed_by, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
