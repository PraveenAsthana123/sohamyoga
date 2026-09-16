export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { name: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const name = decodeURIComponent(params.name);
    const { rows } = await client.query(
      `UPDATE pipeline_health
       SET last_run = NOW(), last_success = NOW(), run_count = run_count + 1, status = 'healthy'
       WHERE pipeline_name = $1
       RETURNING *`,
      [name]
    );
    if (rows.length === 0) return Response.json({ error: 'Pipeline not found' }, { status: 404 });
    return Response.json({ pipeline: rows[0], message: 'Ping recorded successfully' });
  } finally {
    client.release();
  }
}
