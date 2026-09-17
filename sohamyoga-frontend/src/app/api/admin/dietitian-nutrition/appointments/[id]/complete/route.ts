import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { weight_recorded_kg, session_notes, goals_reviewed, next_steps, follow_up_date } = body;

    // Mark appointment completed
    const apptRes = await client.query(
      `UPDATE dn_appointments SET status='completed', weight_recorded_kg=$1, session_notes=$2,
        goals_reviewed=$3, next_steps=$4, follow_up_date=$5
       WHERE id=$6 RETURNING *`,
      [weight_recorded_kg||null, session_notes||null, goals_reviewed||[], next_steps||[], follow_up_date||null, params.id]
    );
    if (!apptRes.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

    // Record weight entry if provided
    if (weight_recorded_kg) {
      await client.query(
        `INSERT INTO dn_weight_entries (client_id, weight_kg, notes) VALUES ($1,$2,$3)`,
        [apptRes.rows[0].client_id, weight_recorded_kg, `Recorded at appointment ${params.id}`]
      );
    }

    return Response.json({ appointment: apptRes.rows[0], weight_entry_recorded: !!weight_recorded_kg });
  } finally { client.release(); }
}
