export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') || '';
  const status = searchParams.get('status') || '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    let sql = 'SELECT * FROM repurpose_assets WHERE project_id=$1';
    const values: unknown[] = [params.id];
    let idx = 2;
    if (platform) { sql += ` AND platform=$${idx++}`; values.push(platform); }
    if (status) { sql += ` AND status=$${idx++}`; values.push(status); }
    sql += ' ORDER BY created_at';
    const { rows } = await client.query(sql, values);
    return Response.json(rows);
  } finally {
    client.release();
  }
}
