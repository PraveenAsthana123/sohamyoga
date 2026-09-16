import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get booking to get room_id and player_count
    const booking = await client.query(`SELECT * FROM er_booking WHERE id=$1`, [params.id]);
    if (!booking.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const b = booking.rows[0];

    // Update booking status
    await client.query(`UPDATE er_booking SET status='completed' WHERE id=$1`, [params.id]);

    // Insert game result
    const result = await client.query(
      `INSERT INTO er_game_result (booking_id,room_id,escaped,time_taken_minutes,hints_used,final_clue_reached,player_count,game_master,notes,customer_rating,customer_feedback)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [params.id, b.room_id, body.escaped, body.time_taken_minutes,
       body.hints_used||0, body.final_clue_reached||false,
       b.player_count, body.game_master||null, body.notes||null,
       body.customer_rating||null, body.customer_feedback||null]
    );

    // Recalculate room success rate
    await client.query(
      `UPDATE er_room SET
         total_plays = total_plays + 1,
         success_rate_pct = (
           SELECT ROUND(AVG(CASE WHEN escaped THEN 100.0 ELSE 0 END),1)
           FROM er_game_result WHERE room_id=$1
         )
       WHERE id=$1`,
      [b.room_id]
    );

    return Response.json({ game_result: result.rows[0] });
  } finally {
    client.release();
  }
}
