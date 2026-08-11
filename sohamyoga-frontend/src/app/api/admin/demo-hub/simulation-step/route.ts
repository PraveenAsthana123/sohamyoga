import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only "inspect" steps for the Guided Simulation page — each (flow,
 * step) pair maps to one whitelisted, hand-written query, never
 * user-supplied SQL. This is the query half of the simulation; the
 * "trigger" half reuses the existing POST /api/admin/demo-hub/run-job so a
 * simulation step actually runs the same job code a real schedule would.
 */
const STEPS: Record<string, Record<string, string>> = {
  'voice-of-customer': {
    'source-data': `SELECT id, subject, message, created_at FROM campaign_lead
      WHERE message IS NOT NULL AND created_at >= now() - interval '7 days' ORDER BY created_at DESC LIMIT 10`,
    'result': `SELECT period_end, source_message_count, overall_summary, themes FROM voice_of_customer_digest
      ORDER BY period_start DESC LIMIT 1`,
  },
  'churn-prediction': {
    'source-data': `SELECT s.display_name, s.email, e.status AS enrollment_status,
        (SELECT max(ar.attended_at) FROM attendance_record ar WHERE ar.student_id = s.id) AS last_attended
      FROM student s JOIN enrollment e ON e.student_id = s.id AND e.status = 'active'
      WHERE s.status = 'active' LIMIT 10`,
    'result': `SELECT s.display_name, cp.risk_score, cp.risk_level, cp.top_reason, cp.suggested_action
      FROM churn_prediction cp JOIN student s ON s.id = cp.student_id ORDER BY cp.predicted_at DESC LIMIT 10`,
  },
  'campaign-health-audit': {
    'source-data': `SELECT name, status, daily_budget_cents,
        (SELECT count(*) FROM ad_group g WHERE g.campaign_id = c.id) AS ad_group_count
      FROM ad_campaign c WHERE status = 'active' LIMIT 10`,
    'result': `SELECT c.name AS campaign_name, f.finding_key, f.severity, f.summary
      FROM ad_campaign_health_finding f JOIN ad_campaign c ON c.id = f.campaign_id
      WHERE f.status = 'open' ORDER BY f.created_at DESC LIMIT 10`,
  },
};

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const flow = req.nextUrl.searchParams.get('flow') ?? '';
  const step = req.nextUrl.searchParams.get('step') ?? '';
  const sql = STEPS[flow]?.[step];
  if (!sql) return Response.json({ error: `Unknown flow/step: ${flow}/${step}` }, { status: 404 });

  const rows = await query(sql);
  return Response.json({ flow, step, rows: rows.rows });
}
