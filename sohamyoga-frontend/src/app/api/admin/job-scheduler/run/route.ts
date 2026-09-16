export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { job_name?: string };
  if (!body.job_name) return Response.json({ error: 'job_name required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO job_run_log (job_name, started_at, status, triggered_by)
       VALUES ($1, NOW(), 'running', 'manual')
       RETURNING id`,
      [body.job_name]
    ).catch(() => ({ rows: [] }));

    const runId = result.rows[0]?.id as number | undefined;
    return Response.json({ ok: true, run_id: runId });
  } finally {
    client.release();
  }
}
