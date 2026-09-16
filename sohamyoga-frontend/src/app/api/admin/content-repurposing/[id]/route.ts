export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM repurpose_projects WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: assets } = await client.query('SELECT * FROM repurpose_assets WHERE project_id=$1 ORDER BY created_at', [params.id]);
    const { rows: bundles } = await client.query('SELECT * FROM content_bundles WHERE project_id=$1 ORDER BY created_at DESC', [params.id]);
    return Response.json({ project: rows[0], assets, bundles });
  } finally {
    client.release();
  }
}
