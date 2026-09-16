export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const pipelineRes = await client.query(`SELECT * FROM pipeline WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
    if (!pipelineRes.rows.length) return Response.json({ error: 'Pipeline not found' }, { status: 404 });
    const pipeline = pipelineRes.rows[0];

    const runId = `${pipeline.name.replace(/\s/g, '-')}-${Date.now()}`;
    const stagesTotal = pipeline.stage_count || 0;

    const { rows } = await client.query(
      `INSERT INTO pipeline_run (pipeline_id, run_id, status, triggered_by, stages_total)
       VALUES ($1, $2, 'running', 'manual', $3) RETURNING *`,
      [id, runId, stagesTotal]
    ).catch(() => ({ rows: [] }));

    // Update pipeline last_run info
    await client.query(
      `UPDATE pipeline SET last_run_at = NOW(), last_run_status = 'running', run_count = run_count + 1 WHERE id = $1`,
      [id]
    ).catch(() => {});

    return Response.json({ run: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
