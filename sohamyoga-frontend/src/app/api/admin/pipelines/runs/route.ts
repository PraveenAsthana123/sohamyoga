export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get('pipeline_id');
  const status = url.searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (pipelineId) { conditions.push(`pr.pipeline_id = $${idx++}`); params.push(pipelineId); }
  if (status) { conditions.push(`pr.status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT pr.*, p.name AS pipeline_name
       FROM pipeline_run pr
       JOIN pipeline p ON p.id = pr.pipeline_id
       ${where}
       ORDER BY pr.started_at DESC
       LIMIT 200`,
      params
    ).catch(() => ({ rows: [] }));
    return Response.json({ runs: rows });
  } finally {
    client.release();
  }
}
