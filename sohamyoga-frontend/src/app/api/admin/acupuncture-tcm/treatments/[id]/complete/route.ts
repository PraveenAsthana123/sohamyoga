import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `UPDATE tcm_treatment SET
        status = 'completed',
        tongue_findings = $1,
        pulse_findings = $2,
        tcm_diagnosis = $3,
        pattern_differentiation = $4,
        points_needled = $5,
        needle_retention_minutes = $6,
        cupping_areas = $7,
        moxa_points = $8,
        herbal_formula = $9,
        herbal_modifications = $10,
        patient_response = $11,
        post_treatment_advice = $12,
        fee = $13,
        extended_health_claimed = $14,
        mva_claimed = $15,
        patient_paid = $16,
        payment_method = $17
      WHERE id = $18 RETURNING *`,
      [
        b.tongue_findings || null,
        b.pulse_findings || null,
        b.tcm_diagnosis || null,
        b.pattern_differentiation || null,
        b.points_needled || null,
        b.needle_retention_minutes || 25,
        b.cupping_areas || null,
        b.moxa_points || null,
        b.herbal_formula || null,
        b.herbal_modifications || null,
        b.patient_response || null,
        b.post_treatment_advice || null,
        b.fee || null,
        b.extended_health_claimed || null,
        b.mva_claimed || null,
        b.patient_paid || null,
        b.payment_method || null,
        params.id,
      ]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
