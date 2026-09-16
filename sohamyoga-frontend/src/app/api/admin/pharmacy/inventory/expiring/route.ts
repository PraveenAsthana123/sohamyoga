import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '90');
    const rows = await client.query(
      `SELECT * FROM rx_inventory WHERE expiry_date IS NOT NULL AND expiry_date <= (NOW() + INTERVAL '${days} days')::date ORDER BY expiry_date ASC LIMIT 200`
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}
