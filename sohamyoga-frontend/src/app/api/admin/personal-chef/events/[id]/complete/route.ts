import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows: eventRows } = await client.query(`
        UPDATE chef_event
        SET status='completed', grocery_actual=$2, total_billed=$3,
            client_rating=$4, client_feedback=$5, payment_status='paid'
        WHERE id=$1 RETURNING client_id, total_billed
      `, [
        params.id,
        body.grocery_actual || null,
        body.total_billed || null,
        body.client_rating || null,
        body.client_feedback || null,
      ]);
      if (!eventRows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

      const { client_id, total_billed } = eventRows[0];
      await client.query(`
        UPDATE chef_client SET total_events=total_events+1, total_spent=total_spent+$2 WHERE id=$1
      `, [client_id, parseFloat(total_billed) || 0]);

      return Response.json({ success: true });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
