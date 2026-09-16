export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [workflows, runs, approvals, mktEvents] = await Promise.all([
      client.query(`
        SELECT w.*,
          COUNT(DISTINCT wr.id) as run_count_actual,
          COUNT(DISTINCT ws.id) as step_count
        FROM platform_workflow w
        LEFT JOIN platform_workflow_run wr ON wr.workflow_id = w.id
        LEFT JOIN platform_workflow_step ws ON ws.workflow_id = w.id
        GROUP BY w.id
        ORDER BY w.is_active DESC, w.name
      `),
      client.query(`
        SELECT wr.*, w.name as workflow_name
        FROM platform_workflow_run wr
        LEFT JOIN platform_workflow w ON w.id = wr.workflow_id
        ORDER BY wr.started_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM v_mcp_pending_approvals LIMIT 50`).catch(() => ({ rows: [] })),
      client.query(`
        SELECT event_type, status, COUNT(*) as count
        FROM marketing_workflow_event
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_type, status
        ORDER BY count DESC
        LIMIT 20
      `),
    ]);

    const summary = {
      totalWorkflows: workflows.rows.length,
      activeWorkflows: workflows.rows.filter(w => w.is_active).length,
      pendingApprovals: approvals.rows.length,
      marketingEvents30d: mktEvents.rows.reduce((s, r) => s + Number(r.count), 0),
    };

    return NextResponse.json({
      summary,
      workflows: workflows.rows,
      runs: runs.rows,
      approvals: approvals.rows,
      marketingEventStats: mktEvents.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { id: number; is_active?: boolean };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE platform_workflow SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [body.is_active, body.id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ workflow: res.rows[0] });
  } finally {
    client.release();
  }
}
