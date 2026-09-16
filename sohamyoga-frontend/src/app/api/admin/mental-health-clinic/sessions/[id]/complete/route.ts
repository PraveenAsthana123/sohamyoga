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
      `UPDATE mh_session SET
        status = 'completed',
        presenting_issues = $1,
        interventions = $2,
        client_response = $3,
        progress = $4,
        risk_assessment = $5,
        safety_planning_done = $6,
        homework_assigned = $7,
        fee = $8,
        extended_health_claimed = $9,
        eap_claimed = $10,
        aish_claimed = $11,
        patient_paid = $12,
        payment_method = $13
      WHERE id = $14 RETURNING id, status, session_date, risk_assessment`,
      [
        b.presenting_issues || null,
        b.interventions || null,
        b.client_response || null,
        b.progress || null,
        b.risk_assessment || 'no_risk',
        b.safety_planning_done || false,
        b.homework_assigned || null,
        b.fee || null,
        b.extended_health_claimed || null,
        b.eap_claimed || null,
        b.aish_claimed || null,
        b.patient_paid || null,
        b.payment_method || null,
        params.id,
      ]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    // Update client risk level if session risk assessment is higher
    if (b.risk_assessment && b.client_id) {
      const riskOrder = ['no_risk','low_risk','moderate_risk','high_risk','crisis'];
      const riskMap: Record<string, string> = { no_risk: 'low', low_risk: 'low', moderate_risk: 'moderate', high_risk: 'high', crisis: 'crisis' };
      await client.query(
        `UPDATE mh_client SET risk_level = $1 WHERE id = $2`,
        [riskMap[b.risk_assessment] || 'low', b.client_id]
      );
    }
    return Response.json(rows[0]);
  } finally { client.release(); }
}
