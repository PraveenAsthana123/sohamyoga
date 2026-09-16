import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE er_booking SET status='playing' WHERE id=$1 RETURNING *`,
      [params.id]
    );
    if (!r.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ booking: r.rows[0] });
  } finally {
    client.release();
  }
}
