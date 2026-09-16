// WorkflowEngineJob — every 5 minutes
// Finds all active schedule-triggered workflows where next_run_at <= NOW()
// and executes each, recording run + step results in platform_workflow_run / platform_workflow_step_run.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface WorkflowRow {
  id: number;
  name: string;
  trigger_config: {
    cron?: string;
    description?: string;
    [key: string]: unknown;
  };
}

interface StepRow {
  id: number;
  step_order: number;
  action_type: string;
  action_config: Record<string, unknown>;
  condition_field: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  on_failure: string;
}

function parseCronNext(cronExpr: string): Date {
  // Minimal parser: only handles the seed cron patterns
  // "0 9 * * *" → today at 09:00 UTC
  // "0 8 * * 1" → next Monday at 08:00 UTC
  const now = new Date();
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return now;

  const [minute, hour] = parts;
  const next = new Date(now);
  next.setUTCMinutes(parseInt(minute, 10));
  next.setUTCHours(parseInt(hour, 10));
  next.setUTCSeconds(0);
  next.setUTCMilliseconds(0);

  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function shouldRunNow(triggerConfig: WorkflowRow['trigger_config'], lastRunAt: Date | null): boolean {
  const cron = triggerConfig?.cron;
  if (!cron) return false;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const now = new Date();
  const nowMinute = now.getUTCMinutes();
  const nowHour = now.getUTCHours();
  const nowDow = now.getUTCDay(); // 0=Sunday, 1=Monday …

  const [cronMin, cronHour, , , cronDow] = parts;

  const minuteMatch = cronMin === '*' || parseInt(cronMin, 10) === nowMinute;
  const hourMatch   = cronHour === '*' || parseInt(cronHour, 10) === nowHour;
  const dowMatch    = cronDow === '*' || parseInt(cronDow, 10) === nowDow;

  if (!minuteMatch || !hourMatch || !dowMatch) return false;

  // Don't re-run if already ran in the last 4 minutes (de-duplication window)
  if (lastRunAt) {
    const diff = now.getTime() - lastRunAt.getTime();
    if (diff < 4 * 60 * 1000) return false;
  }

  return true;
}

async function executeWorkflowSteps(workflowId: number, runId: number): Promise<{ completed: number; failed: number }> {
  const stepsResult = await db.query<StepRow>(
    'SELECT * FROM platform_workflow_step WHERE workflow_id = $1 ORDER BY step_order ASC',
    [workflowId]
  );
  const steps = stepsResult.rows;

  let completed = 0;
  let failed = 0;

  for (const step of steps) {
    const startMs = Date.now();
    let status: 'success' | 'failed' | 'skipped' = 'success';
    let outputData: Record<string, unknown> = {};
    let errorMsg: string | null = null;

    try {
      switch (step.action_type) {
        case 'wait': {
          const delay = (step.action_config.delay_seconds as number) ?? 0;
          outputData = { simulated_delay_seconds: delay };
          break;
        }
        case 'post_to_platform':
          outputData = { platform: step.action_config.platform, note: 'queued for publish' };
          break;
        case 'ai_adapt_content':
          outputData = { note: 'AI adapt queued for AIContentAdaptJob', target_platforms: step.action_config.target_platforms };
          break;
        case 'send_whatsapp':
          outputData = { phone: step.action_config.phone, note: 'WhatsApp queued' };
          break;
        case 'send_email':
          outputData = { to: step.action_config.to, subject: step.action_config.subject, note: 'Email queued' };
          break;
        case 'condition':
          outputData = { field: step.condition_field, operator: step.condition_operator, value: step.condition_value };
          break;
        case 'webhook_call':
          outputData = { url: step.action_config.url, method: step.action_config.method, note: 'Webhook recorded' };
          break;
        case 'tag_customer':
          outputData = { tag: step.action_config.tag, note: 'Tag queued' };
          break;
        default:
          status = 'skipped';
          outputData = { note: `Unknown action_type: ${step.action_type}` };
      }
    } catch (e) {
      status = 'failed';
      errorMsg = String(e);
    }

    const durationMs = Date.now() - startMs;

    await db.query(
      `INSERT INTO platform_workflow_step_run
         (run_id, step_id, step_order, action_type, status, output_data, error_message, duration_ms, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [runId, step.id, step.step_order, step.action_type, status, JSON.stringify(outputData), errorMsg, durationMs]
    );

    if (status === 'success' || status === 'skipped') {
      completed++;
    } else {
      failed++;
      if (step.on_failure === 'stop') break;
    }
  }

  return { completed, failed };
}

export async function run(): Promise<void> {
  const now = new Date();
  console.log(`[WorkflowEngineJob] Starting at ${now.toISOString()}`);

  // Fetch active schedule workflows
  const workflowsResult = await db.query<{
    id: number;
    name: string;
    trigger_config: WorkflowRow['trigger_config'];
    last_run_at: string | null;
  }>(
    `SELECT id, name, trigger_config, last_run_at
     FROM platform_workflow
     WHERE is_active = true AND trigger_type = 'schedule'`
  );

  let processed = 0;

  for (const wf of workflowsResult.rows) {
    const lastRunAt = wf.last_run_at ? new Date(wf.last_run_at) : null;
    if (!shouldRunNow(wf.trigger_config, lastRunAt)) continue;

    console.log(`[WorkflowEngineJob] Running workflow: ${wf.name} (id=${wf.id})`);

    // Count steps for this workflow
    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM platform_workflow_step WHERE workflow_id = $1',
      [wf.id]
    );
    const stepsTotal = parseInt(countResult.rows[0].count, 10);

    // Create run record
    const runResult = await db.query<{ id: number }>(
      `INSERT INTO platform_workflow_run
         (workflow_id, trigger_event, trigger_data, status, steps_total)
       VALUES ($1,'schedule','{}','running',$2) RETURNING id`,
      [wf.id, stepsTotal]
    );
    const runId = runResult.rows[0].id;

    try {
      const { completed, failed } = await executeWorkflowSteps(wf.id, runId);
      const finalStatus = failed === 0 ? 'success' : completed > 0 ? 'partial' : 'failed';

      await db.query(
        `UPDATE platform_workflow_run
         SET status=$1, steps_completed=$2, steps_failed=$3, completed_at=NOW()
         WHERE id=$4`,
        [finalStatus, completed, failed, runId]
      );

      await db.query(
        `UPDATE platform_workflow
         SET run_count = run_count + 1, last_run_at=NOW(), last_run_status=$1, updated_at=NOW()
         WHERE id=$2`,
        [finalStatus, wf.id]
      );

      console.log(`[WorkflowEngineJob] Workflow ${wf.name} finished: ${finalStatus} (${completed} ok, ${failed} failed)`);
      processed++;
    } catch (e) {
      console.error(`[WorkflowEngineJob] Workflow ${wf.id} failed:`, e);
      await db.query(
        `UPDATE platform_workflow_run SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [String(e), runId]
      );
    }
  }

  console.log(`[WorkflowEngineJob] Done. Processed ${processed} workflows.`);
  await db.end();
}
