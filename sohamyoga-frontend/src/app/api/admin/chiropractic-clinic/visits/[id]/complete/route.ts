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
      `UPDATE chiro_visit SET
        status='completed',
        subjective=$2, pain_level_today=$3,
        objective=$4, range_of_motion=$5,
        assessment=$6, progress=$7, plan=$8,
        adjustments_performed=$9, modalities_used=$10,
        home_exercises_given=$11,
        fee=$12, extended_health_claimed=$13, mva_claimed=$14, wca_claimed=$15,
        patient_paid=$16, payment_method=$17
       WHERE id=$1 RETURNING *`,
      [id,
       b.subjective||null, b.pain_level_today||null,
       b.objective||null, b.range_of_motion||null,
       b.assessment||null, b.progress||null, b.plan||null,
       b.adjustments_performed||null, b.modalities_used||null,
       b.home_exercises_given||null,
       b.fee||null, b.extended_health_claimed||null,
       b.mva_claimed||null, b.wca_claimed||null,
       b.patient_paid||null, b.payment_method||null]
    );
    if (!rows[0]) return Response.json({ error: 'Visit not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
