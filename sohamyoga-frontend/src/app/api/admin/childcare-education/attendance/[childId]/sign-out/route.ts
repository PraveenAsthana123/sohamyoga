import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { childId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE cc_attendance SET sign_out_time = $3, signed_out_by = $4
         WHERE child_id = $1 AND date = $2 RETURNING *`,
        [params.childId, today, timeStr, body.signed_out_by ?? 'Staff']
      );
      if (!rows.length) return Response.json({ error: 'No sign-in record found for today' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
