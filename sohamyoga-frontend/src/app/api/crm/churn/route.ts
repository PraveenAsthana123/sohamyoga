import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [summary, reasons, atRisk] = await Promise.all([
    query<{ total: string; risky: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE risk_level IN ('high','critical')) AS risky FROM churn_prediction`,
    ),
    query<{ top_reason: string; count: string }>(
      `SELECT top_reason, COUNT(*) AS count FROM churn_prediction
       WHERE risk_level IN ('high','critical') GROUP BY top_reason ORDER BY count DESC LIMIT 8`,
    ),
    query<{ student_id: string; display_name: string; risk_level: string; last_class_at: string | null }>(
      `SELECT cp.student_id, s.display_name, cp.risk_level, s.last_class_at
       FROM churn_prediction cp JOIN student s ON s.id = cp.student_id
       WHERE cp.risk_level IN ('medium','high','critical')
       ORDER BY cp.risk_score DESC LIMIT 20`,
    ),
  ]);

  const total = Number(summary.rows[0]?.total ?? 0);
  const risky = Number(summary.rows[0]?.risky ?? 0);
  const reasonTotal = reasons.rows.reduce((s, r) => s + Number(r.count), 0);

  return Response.json({
    churnRatePct: total ? Math.round((risky / total) * 1000) / 10 : 0,
    membersFlagged: risky,
    reasons: reasons.rows.map(r => ({
      reason: r.top_reason, pct: reasonTotal ? Math.round((Number(r.count) / reasonTotal) * 100) : 0,
    })),
    atRisk: atRisk.rows.map(r => ({
      name: r.display_name,
      lastClass: r.last_class_at,
      risk: r.risk_level.charAt(0).toUpperCase() + r.risk_level.slice(1),
    })),
  });
}
