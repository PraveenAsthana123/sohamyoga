export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { workflow_id?: number; triggered_by?: string };
  if (!body.workflow_id) return Response.json({ error: 'workflow_id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    // Get step count from workflow
    const wfRes = await client.query(
      `SELECT steps FROM workflow WHERE id=$1`,
      [body.workflow_id]
    ).catch(() => ({ rows: [] }));

    const steps = (wfRes.rows[0]?.steps as unknown[]) ?? [];
    const stepsTotal = steps.length;

    const result = await client.query(
      `INSERT INTO workflow_run (workflow_id, status, steps_total, triggered_by)
       VALUES ($1, 'running', $2, $3)
       RETURNING id`,
      [body.workflow_id, stepsTotal, body.triggered_by ?? 'manual']
    ).catch(() => ({ rows: [] }));

    await client.query(
      `UPDATE workflow SET run_count=run_count+1, last_run_at=NOW(), last_run_status='running' WHERE id=$1`,
      [body.workflow_id]
    ).catch(() => {});

    return Response.json({ ok: true, run_id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}
