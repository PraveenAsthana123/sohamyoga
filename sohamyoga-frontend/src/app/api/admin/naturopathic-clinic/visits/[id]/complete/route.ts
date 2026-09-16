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
      `UPDATE nd_visit SET
        status = 'completed',
        subjective = $1, objective = $2, assessment = $3, plan = $4,
        labs_ordered = $5, labs_reviewed = $6, lab_findings = $7,
        therapies_used = $8,
        supplements_prescribed = $9,
        dietary_recommendations = $10, lifestyle_recommendations = $11,
        fee = $12, extended_health_claimed = $13, patient_paid = $14, payment_method = $15
      WHERE id = $16 RETURNING *`,
      [
        b.subjective || null, b.objective || null, b.assessment || null, b.plan || null,
        b.labs_ordered || null, b.labs_reviewed || null, b.lab_findings || null,
        b.therapies_used || null,
        b.supplements_prescribed ? JSON.stringify(b.supplements_prescribed) : null,
        b.dietary_recommendations || null, b.lifestyle_recommendations || null,
        b.fee || null, b.extended_health_claimed || null, b.patient_paid || null, b.payment_method || null,
        params.id,
      ]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
