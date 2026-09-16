export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'));
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    const { rows } = await client.query(
      'SELECT * FROM pii_scans ORDER BY scanned_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    ).catch(() => ({ rows: [] }));

    const { rows: total } = await client.query('SELECT COUNT(*)::int AS c FROM pii_scans').catch(() => ({ rows: [{ c: 0 }] }));

    return Response.json({ scans: rows, total: total[0].c });
  } finally {
    client.release();
  }
}
