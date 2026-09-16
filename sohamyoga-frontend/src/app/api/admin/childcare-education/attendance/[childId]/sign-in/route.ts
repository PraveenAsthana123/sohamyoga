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
        `INSERT INTO cc_attendance (child_id, date, sign_in_time, signed_in_by, present)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (child_id, date) DO UPDATE SET sign_in_time = $3, signed_in_by = $4, present = true
         RETURNING *`,
        [params.childId, today, timeStr, body.signed_in_by ?? 'Staff']
      );
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
