import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, scan_type, target, critical_count, high_count, medium_count, passed_count, scanned_at
       FROM security_scans ORDER BY scanned_at DESC LIMIT 20`
    );
    return Response.json({ scans: rows });
  } finally {
    client.release();
  }
}
