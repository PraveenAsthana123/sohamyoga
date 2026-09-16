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
    const { total_amount, tip_amount = 0, payment_method } = body;
    if (!total_amount) return Response.json({ error: 'total_amount required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Mark appointment completed
      const { rows: apptRows } = await client.query(
        `UPDATE salon_appointment SET status='completed', total_amount=$1, tip_amount=$2, payment_method=$3 WHERE id=$4 RETURNING client_id`,
        [total_amount, tip_amount, payment_method ?? null, params.id]
      );
      if (!apptRows[0]) return Response.json({ error: 'Appointment not found' }, { status: 404 });
      // Update client: loyalty_points (+1 per $10), total_spent, visit_count, last_visit
      const loyaltyEarned = Math.floor(Number(total_amount) / 10);
      await client.query(
        `UPDATE salon_client SET
          loyalty_points = loyalty_points + $1,
          total_spent = total_spent + $2,
          visit_count = visit_count + 1,
          last_visit = CURRENT_DATE
         WHERE id=$3`,
        [loyaltyEarned, total_amount, apptRows[0].client_id]
      );
      return Response.json({ success: true, loyalty_points_earned: loyaltyEarned });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
