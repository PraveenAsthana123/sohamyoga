import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const workflowId = parseInt(id, 10);
    const runsResult = await query<{
      id: number;
      workflow_id: number;
      trigger_event: string;
      trigger_data: Record<string, unknown>;
      status: string;
      steps_total: number;
      steps_completed: number;
      steps_failed: number;
      error_message: string | null;
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
    }>(`
      SELECT
        r.*,
        EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.started_at)) * 1000 AS duration_ms
      FROM platform_workflow_run r
      WHERE r.workflow_id = $1
      ORDER BY r.started_at DESC
      LIMIT 50
    `, [workflowId]);

    const runs = await Promise.all(
      runsResult.rows.map(async (run) => {
        const stepRunsResult = await query<{
          id: number;
          step_order: number;
          action_type: string;
          status: string;
          output_data: Record<string, unknown>;
          error_message: string | null;
          duration_ms: number | null;
          started_at: string;
          completed_at: string | null;
        }>(
          'SELECT id, step_order, action_type, status, output_data, error_message, duration_ms, started_at, completed_at FROM platform_workflow_step_run WHERE run_id = $1 ORDER BY step_order ASC',
          [run.id]
        );
        return { ...run, step_runs: stepRunsResult.rows };
      })
    );

    return Response.json({ runs });
  } catch (err) {
    console.error('GET runs error:', err);
    return Response.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}
