export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { wf_id?: number; triggered_by?: string };
  if (!body.wf_id) return Response.json({ error: 'wf_id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const wfRes = await client.query(
      `SELECT steps FROM wf_definition WHERE id=$1`,
      [body.wf_id]
    ).catch(() => ({ rows: [] }));

    const steps = (wfRes.rows[0]?.steps as unknown[]) ?? [];
    const stepsTotal = steps.length;

    const result = await client.query(
      `INSERT INTO wf_run (wf_id, status, steps_total, triggered_by)
       VALUES ($1, 'running', $2, $3)
       RETURNING id`,
      [body.wf_id, stepsTotal, body.triggered_by ?? 'manual']
    ).catch(() => ({ rows: [] }));

    await client.query(
      `UPDATE wf_definition SET run_count=run_count+1, last_run_at=NOW(), last_run_status='running' WHERE id=$1`,
      [body.wf_id]
    ).catch(() => {});

    return Response.json({ ok: true, run_id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}
