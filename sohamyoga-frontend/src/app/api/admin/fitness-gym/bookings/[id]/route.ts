import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { status, payment_status } = body;
    if (!status) return Response.json({ error: 'status required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const sets: string[] = ['status=$1'];
      const vals: unknown[] = [status];
      if (status === 'cancelled') { sets.push('cancelled_at=NOW()'); }
      if (payment_status) { vals.push(payment_status); sets.push(`payment_status=$${vals.length}`); }
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE gym_booking SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ booking: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
