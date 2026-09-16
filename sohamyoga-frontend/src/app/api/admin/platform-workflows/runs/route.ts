import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query<{
      id: number;
      workflow_id: number;
      workflow_name: string;
      trigger_event: string;
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
        r.id,
        r.workflow_id,
        w.name AS workflow_name,
        r.trigger_event,
        r.status,
        r.steps_total,
        r.steps_completed,
        r.steps_failed,
        r.error_message,
        r.started_at,
        r.completed_at,
        EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.started_at)) * 1000 AS duration_ms
      FROM platform_workflow_run r
      JOIN platform_workflow w ON w.id = r.workflow_id
      ORDER BY r.started_at DESC
      LIMIT 100
    `);
    return NextResponse.json({ runs: result.rows });
  } catch (err) {
    console.error('GET all runs error:', err);
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}
