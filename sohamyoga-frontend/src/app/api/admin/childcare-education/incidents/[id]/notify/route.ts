import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE cc_incident SET parent_notified = true, parent_notified_at = NOW() WHERE id = $1 RETURNING *`,
        [params.id]
      );
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
