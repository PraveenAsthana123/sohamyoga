export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ traceId: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { traceId } = await params;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM trace WHERE trace_id = $1 ORDER BY started_at ASC`,
      [traceId]
    ).catch(() => ({ rows: [] }));
    return Response.json({ spans: rows });
  } finally {
    client.release();
  }
}
