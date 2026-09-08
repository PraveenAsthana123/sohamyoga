// Real ownership/SLA layer for provisioning_human_task, which previously had
// no due date and nothing that would ever alert anyone it existed. Purely
// deterministic (no Ollama) -- staleness is a date comparison, not something
// that benefits from a drafted summary. Never mutates task content, only
// assigns a due date to tasks that lack one and raises/resolves alerts.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const DUE_WINDOW_DAYS = 3;

export async function run(): Promise<void> {
  const dueSet = await db.query(
    `UPDATE provisioning_human_task SET due_at = created_at + interval '${DUE_WINDOW_DAYS} days'
     WHERE status = 'open' AND due_at IS NULL`,
  );

  const overdue = await db.query<{ id: string; platform: string; task_type: string; due_at: string }>(
    `SELECT id, platform, task_type, due_at FROM provisioning_human_task WHERE status = 'open' AND due_at < now()`,
  );

  let created = 0;
  for (const task of overdue.rows) {
    const daysOverdue = Math.floor((Date.now() - new Date(task.due_at).getTime()) / 86_400_000);
    const severity = daysOverdue > 7 ? 'critical' : 'warning';
    const summary = `${task.task_type} for ${task.platform} has been open ${daysOverdue} day(s) past its due date with no one assigned.`;
    const result = await db.query(
      `INSERT INTO provisioning_task_alert (task_id, platform, severity, summary)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (task_id) DO UPDATE SET severity = EXCLUDED.severity, summary = EXCLUDED.summary
       WHERE provisioning_task_alert.status = 'open'`,
      [task.id, task.platform, severity, summary],
    );
    created += result.rowCount ?? 0;
  }

  const resolved = await db.query(
    `UPDATE provisioning_task_alert a SET status = 'resolved', resolved_at = now()
     WHERE a.status = 'open' AND EXISTS (
       SELECT 1 FROM provisioning_human_task t
       WHERE t.id = a.task_id AND (t.status <> 'open' OR t.due_at >= now())
     )`,
  );

  console.log(`[provisioning-task-staleness] due_dates_assigned=${dueSet.rowCount} overdue=${overdue.rows.length} alerts_upserted=${created} alerts_resolved=${resolved.rowCount ?? 0}`);
  // Do NOT db.end() -- this module is cached and reused across every
  // scheduled invocation; ending the pool breaks every subsequent run.
}
