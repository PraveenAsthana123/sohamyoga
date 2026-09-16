import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    const { rows } = await client.query(
      `UPDATE ot_session SET
        status='completed',
        goals_addressed=$2, interventions=$3,
        client_participation=$4, session_notes=$5,
        caregiver_education=$6, recommendations=$7,
        fee=$8, insurance_claimed=$9, patient_paid=$10
       WHERE id=$1 RETURNING *`,
      [id,
       b.goals_addressed||null, b.interventions||null,
       b.client_participation||null, b.session_notes||null,
       b.caregiver_education||null, b.recommendations||null,
       b.fee||null, b.insurance_claimed||null, b.patient_paid||null]
    );
    if (!rows[0]) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
