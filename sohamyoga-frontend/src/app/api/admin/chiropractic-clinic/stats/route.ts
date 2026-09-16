import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [visitTrend, diagBreakdown, painImprovement, payerBreakdown] = await Promise.all([
      client.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', visit_date), 'Mon YYYY') AS month,
               COUNT(*) AS visits, SUM(fee) AS revenue
        FROM chiro_visit WHERE visit_date >= NOW() - INTERVAL '6 months' AND status='completed'
        GROUP BY DATE_TRUNC('month', visit_date) ORDER BY DATE_TRUNC('month', visit_date)
      `),
      client.query(`
        SELECT primary_complaint, COUNT(*) AS count
        FROM chiro_patient GROUP BY primary_complaint ORDER BY count DESC LIMIT 10
      `),
      client.query(`
        SELECT p.id, p.first_name, p.last_name, p.pain_level AS intake_pain,
               AVG(v.pain_level_today) AS avg_current_pain,
               MIN(v.pain_level_today) AS min_pain
        FROM chiro_patient p
        JOIN chiro_visit v ON v.patient_id=p.id
        WHERE v.status='completed' AND v.pain_level_today IS NOT NULL AND p.pain_level IS NOT NULL
        GROUP BY p.id, p.first_name, p.last_name, p.pain_level
        HAVING COUNT(v.id) >= 3
        ORDER BY (p.pain_level - AVG(v.pain_level_today)) DESC LIMIT 10
      `),
      client.query(`
        SELECT
          SUM(CASE WHEN mva_claimed > 0 THEN mva_claimed ELSE 0 END) AS mva_total,
          SUM(CASE WHEN wca_claimed > 0 THEN wca_claimed ELSE 0 END) AS wca_total,
          SUM(CASE WHEN extended_health_claimed > 0 THEN extended_health_claimed ELSE 0 END) AS extended_total,
          SUM(CASE WHEN patient_paid > 0 THEN patient_paid ELSE 0 END) AS cash_total,
          COUNT(*) AS total_visits
        FROM chiro_visit WHERE status='completed'
      `),
    ]);
    return Response.json({
      visit_trend: visitTrend.rows,
      diagnosis_breakdown: diagBreakdown.rows,
      pain_improvement: painImprovement.rows,
      payer_breakdown: payerBreakdown.rows[0],
    });
  } finally {
    client.release();
  }
}
