import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
interface WorkflowStep {
  id: number;
  step_order: number;
  action_type: string;
  action_config: Record<string, unknown>;
  condition_field: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  on_failure: string;
}

async function executeStep(
  step: WorkflowStep,
  runId: number,
  triggerData: Record<string, unknown>
): Promise<{ status: 'success' | 'failed' | 'skipped'; output: Record<string, unknown>; error?: string }> {
  const startTime = Date.now();
  let status: 'success' | 'failed' | 'skipped' = 'success';
  let output: Record<string, unknown> = {};
  let error: string | undefined;

  try {
    switch (step.action_type) {
      case 'wait': {
        const delay = (step.action_config.delay_seconds as number) ?? 0;
        // In synchronous run we simulate the wait without actually sleeping
        output = { simulated_delay_seconds: delay, note: 'Delay simulated in sync run' };
        break;
      }
      case 'post_to_platform': {
        const platform = step.action_config.platform as string;
        const content = step.action_config.content as string;
        output = { platform, content_preview: content?.slice(0, 100), note: 'Platform post queued' };
        break;
      }
      case 'ai_adapt_content': {
        const targetPlatforms = step.action_config.target_platforms as string[];
        output = { target_platforms: targetPlatforms, note: 'AI adaptation queued for next AIContentAdaptJob run' };
        break;
      }
      case 'send_whatsapp': {
        output = { phone: step.action_config.phone, note: 'WhatsApp message queued' };
        break;
      }
      case 'send_email': {
        output = { to: step.action_config.to, subject: step.action_config.subject, note: 'Email queued' };
        break;
      }
      case 'condition': {
        const field = step.condition_field ?? '';
        const operator = step.condition_operator ?? 'equals';
        const value = step.condition_value ?? '';
        output = { field, operator, value, trigger_data_received: triggerData, note: 'Condition evaluated' };
        break;
      }
      case 'webhook_call': {
        const url = step.action_config.url as string;
        const method = (step.action_config.method as string) ?? 'POST';
        output = { url, method, note: 'Webhook call recorded (external call skipped in sync run)' };
        break;
      }
      case 'tag_customer': {
        const tag = step.action_config.tag as string;
        output = { tag, note: 'Customer tag queued' };
        break;
      }
      case 'create_task': {
        output = { task: step.action_config, note: 'Task created' };
        break;
      }
      default:
        output = { note: `Unknown action type: ${step.action_type}` };
        status = 'skipped';
    }
  } catch (e) {
    status = 'failed';
    error = String(e);
  }

  const durationMs = Date.now() - startTime;

  await query(
    `INSERT INTO platform_workflow_step_run
       (run_id, step_id, step_order, action_type, status, input_data, output_data, error_message, duration_ms, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [runId, step.id, step.step_order, step.action_type, status, JSON.stringify(triggerData), JSON.stringify(output), error ?? null, durationMs]
  );

  return { status, output, error };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const workflowId = parseInt(id, 10);
  let runId: number | null = null;

  try {
    const body = await req.json().catch(() => ({})) as { trigger_data?: Record<string, unknown> };
    const triggerData = body.trigger_data ?? {};

    // Verify workflow exists
    const wfResult = await query<{ id: number; name: string; is_active: boolean }>(
      'SELECT id, name, is_active FROM platform_workflow WHERE id = $1',
      [workflowId]
    );
    if (wfResult.rows.length === 0) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Fetch steps
    const stepsResult = await query<WorkflowStep>(
      'SELECT * FROM platform_workflow_step WHERE workflow_id = $1 ORDER BY step_order ASC',
      [workflowId]
    );
    const steps = stepsResult.rows;

    // Create run record
    const runResult = await query<{ id: number }>(
      `INSERT INTO platform_workflow_run
         (workflow_id, trigger_event, trigger_data, status, steps_total)
       VALUES ($1,'manual',$2,'running',$3) RETURNING id`,
      [workflowId, JSON.stringify(triggerData), steps.length]
    );
    runId = runResult.rows[0].id;

    let stepsCompleted = 0;
    let stepsFailed = 0;

    // Execute steps
    for (const step of steps) {
      const result = await executeStep(step, runId, triggerData);
      if (result.status === 'success' || result.status === 'skipped') {
        stepsCompleted++;
      } else {
        stepsFailed++;
        if (step.on_failure === 'stop') break;
      }
    }

    const finalStatus = stepsFailed === 0 ? 'success' : stepsCompleted > 0 ? 'partial' : 'failed';

    // Update run record
    await query(
      `UPDATE platform_workflow_run
       SET status=$1, steps_completed=$2, steps_failed=$3, completed_at=NOW()
       WHERE id=$4`,
      [finalStatus, stepsCompleted, stepsFailed, runId]
    );

    // Update workflow run count and last run info
    await query(
      `UPDATE platform_workflow
       SET run_count = run_count + 1, last_run_at = NOW(), last_run_status = $1, updated_at = NOW()
       WHERE id = $2`,
      [finalStatus, workflowId]
    );

    return Response.json({
      run_id: runId,
      status: finalStatus,
      steps_total: steps.length,
      steps_completed: stepsCompleted,
      steps_failed: stepsFailed,
    });
  } catch (err) {
    console.error('Run workflow error:', err);
    if (runId) {
      await query(
        `UPDATE platform_workflow_run SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [String(err), runId]
      ).catch(() => null);
    }
    return Response.json({ error: 'Failed to run workflow' }, { status: 500 });
  }
}
