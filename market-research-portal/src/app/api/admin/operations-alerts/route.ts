import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { query } from '../../../../lib/postgres';
import { runOperationsAlertSweep } from '../../../../domain/pipeline/OperationsAlertSweep';
import { withApiErrorLog } from '../../../../lib/api-error-log';

export const dynamic = 'force-dynamic';

// GET always sweeps first (cheap, indexed, idempotent) so the mandatory
// tracking view is never stale even if the cron sweep hasn't run yet.
async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await runOperationsAlertSweep();

  const [tables, alerts, events, jobRuns] = await Promise.all([
    query(
      `SELECT t.source_table, t.display_name, t.description,
              count(a.id) FILTER (WHERE a.status = 'open') AS open_count,
              count(a.id) FILTER (WHERE a.status = 'acknowledged') AS acknowledged_count,
              count(a.id) FILTER (WHERE a.status = 'resolved') AS resolved_count,
              max(a.last_seen_at) AS last_seen_at
       FROM ref_tracked_operation t
       LEFT JOIN operations_alert a ON a.source_table = t.source_table
       WHERE t.enabled
       GROUP BY t.source_table, t.display_name, t.description
       ORDER BY open_count DESC, t.display_name`,
    ),
    query(
      `SELECT a.*, t.display_name AS source_display_name
       FROM operations_alert a JOIN ref_tracked_operation t ON t.source_table = a.source_table
       WHERE a.status != 'resolved'
       ORDER BY (a.severity = 'critical') DESC, a.last_seen_at DESC LIMIT 200`,
    ),
    // Mandatory transactional history — every alert state change, real timestamp.
    query(
      `SELECT e.id, e.alert_id, e.event_type, e.detail, e.actor, e.occurred_at
       FROM operations_alert_event e
       ORDER BY e.occurred_at DESC LIMIT 100`,
    ),
    // Automatic Process tab — the real scheduled sweep job's own run history.
    query(
      `SELECT id, job_name, status, started_at, completed_at, duration_ms, error_message, result_summary
       FROM job_run WHERE job_name = 'operations-alert-sweep'
       ORDER BY created_at DESC LIMIT 20`,
    ),
  ]);

  return Response.json({ tables: tables.rows, alerts: alerts.rows, events: events.rows, jobRuns: jobRuns.rows });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { alertId?: string; action?: string } | null;
  if (!body?.alertId || !['acknowledge', 'resolve', 'reopen'].includes(body.action ?? '')) {
    return Response.json({ error: 'alertId and a valid action (acknowledge|resolve|reopen) are required.' }, { status: 400 });
  }
  const setClause =
    body.action === 'acknowledge' ? `status='acknowledged', acknowledged_at=now(), acknowledged_by='admin'` :
    body.action === 'resolve'     ? `status='resolved', resolved_at=now()` :
                                     `status='open', acknowledged_at=NULL, acknowledged_by=NULL, resolved_at=NULL`;
  const r = await query(`UPDATE operations_alert SET ${setClause} WHERE id=$1 RETURNING *`, [body.alertId]);
  if (!r.rowCount) return Response.json({ error: 'Alert not found.' }, { status: 404 });
  await query(
    `INSERT INTO operations_alert_event (alert_id, event_type, detail, actor) VALUES ($1,$2,$3,'admin')`,
    [body.alertId, body.action === 'acknowledge' ? 'acknowledged' : body.action === 'resolve' ? 'resolved' : 'reopened', ''],
  );
  return Response.json({ alert: r.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const PATCH = withApiErrorLog(handlePatch);
