import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [escapeByRoom, revenueByDay, groupBreakdown, avgHints, playerDist] = await Promise.all([
      client.query(
        `SELECT r.room_name,
           COUNT(gr.id) AS total_plays,
           ROUND(AVG(CASE WHEN gr.escaped THEN 100.0 ELSE 0 END),1) AS escape_rate_pct,
           ROUND(AVG(gr.hints_used),1) AS avg_hints
         FROM er_room r LEFT JOIN er_game_result gr ON gr.room_id=r.id
         GROUP BY r.id,r.room_name ORDER BY escape_rate_pct DESC NULLS LAST`
      ),
      client.query(
        `SELECT DATE(b.created_at) AS day, COALESCE(SUM(b.total_amount),0) AS revenue, COUNT(*) AS bookings
         FROM er_booking b WHERE b.created_at>=NOW()-INTERVAL '7 days' AND b.status NOT IN ('cancelled','no_show')
         GROUP BY DATE(b.created_at) ORDER BY day`
      ),
      client.query(
        `SELECT group_type, COUNT(*) AS cnt FROM er_booking
         WHERE group_type IS NOT NULL AND status NOT IN ('cancelled','no_show')
         GROUP BY group_type ORDER BY cnt DESC`
      ),
      client.query(`SELECT ROUND(AVG(hints_used),1) AS avg FROM er_game_result`),
      client.query(
        `SELECT player_count, COUNT(*) AS cnt FROM er_booking
         WHERE status NOT IN ('cancelled','no_show')
         GROUP BY player_count ORDER BY player_count`
      ),
    ]);

    return Response.json({
      escape_by_room: escapeByRoom.rows,
      revenue_by_day: revenueByDay.rows,
      group_breakdown: groupBreakdown.rows,
      avg_hints_overall: Number(avgHints.rows[0]?.avg)||0,
      player_distribution: playerDist.rows,
    });
  } finally {
    client.release();
  }
}
