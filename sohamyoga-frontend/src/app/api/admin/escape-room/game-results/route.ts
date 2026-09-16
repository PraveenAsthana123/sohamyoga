import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const room_id = searchParams.get('room_id') ?? '';
  const date = searchParams.get('date') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (room_id) { conditions.push(`gr.room_id=$${values.length+1}`); values.push(room_id); }
    if (date) { conditions.push(`DATE(gr.created_at)=$${values.length+1}`); values.push(date); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [results, stats] = await Promise.all([
      client.query(
        `SELECT gr.*,r.room_name,r.theme,b.customer_name,b.group_type
         FROM er_game_result gr
         LEFT JOIN er_room r ON r.id=gr.room_id
         LEFT JOIN er_booking b ON b.id=gr.booking_id
         ${where} ORDER BY gr.created_at DESC LIMIT 100`,
        values
      ),
      client.query(
        `SELECT
           r.room_name,
           COUNT(gr.id) AS total_plays,
           ROUND(AVG(CASE WHEN gr.escaped THEN 100.0 ELSE 0 END),1) AS escape_rate,
           ROUND(AVG(gr.hints_used),1) AS avg_hints,
           MIN(CASE WHEN gr.escaped THEN gr.time_taken_minutes END) AS best_time
         FROM er_game_result gr
         JOIN er_room r ON r.id=gr.room_id
         GROUP BY r.id,r.room_name ORDER BY escape_rate DESC`
      ),
    ]);

    return Response.json({ results: results.rows, room_stats: stats.rows });
  } finally {
    client.release();
  }
}
