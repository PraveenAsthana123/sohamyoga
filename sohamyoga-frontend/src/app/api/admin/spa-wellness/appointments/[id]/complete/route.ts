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
      // Mark appointment complete
      const { rows: apptRows } = await client.query(`
        UPDATE spa_appointment
        SET status='completed', pressure_used=$2, areas_focused=$3,
            aftercare_given=$4, client_feedback=$5, client_rating=$6,
            amount=$7, tip=$8, payment_method=$9, massage_benefit_claimed=$10
        WHERE id=$1 RETURNING client_id, amount, tip
      `, [
        params.id,
        body.pressure_used || null,
        body.areas_focused || [],
        body.aftercare_given || null,
        body.client_feedback || null,
        body.client_rating || null,
        body.amount || 0,
        body.tip || 0,
        body.payment_method || null,
        body.massage_benefit_claimed || false,
      ]);
      if (!apptRows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

      const { client_id, amount, tip } = apptRows[0];
      const total = parseFloat(amount) + parseFloat(tip);
      const loyaltyEarned = Math.floor(total / 10);

      // Update client stats
      await client.query(`
        UPDATE spa_client
        SET total_visits = total_visits + 1,
            total_spent = total_spent + $2,
            loyalty_points = loyalty_points + $3,
            last_visit = CURRENT_DATE
        WHERE id=$1
      `, [client_id, total, loyaltyEarned]);

      return Response.json({ success: true, loyalty_points_earned: loyaltyEarned });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
