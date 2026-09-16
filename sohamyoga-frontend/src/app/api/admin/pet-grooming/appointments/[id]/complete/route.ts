import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { price, tip_amount = 0, payment_method } = body;
  if (!price) return Response.json({ error: 'price is required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get appointment with owner info
    const apptRes = await client.query(
      `SELECT a.*, p.owner_id FROM pg_appointment a LEFT JOIN pg_pet p ON a.pet_id = p.id WHERE a.id = $1`,
      [params.id]
    );
    if (!apptRes.rows.length) return Response.json({ error: 'Appointment not found' }, { status: 404 });
    const appt = apptRes.rows[0];

    // Complete appointment
    const result = await client.query(
      `UPDATE pg_appointment
       SET status = 'completed', price = $1, tip_amount = $2, payment_method = $3
       WHERE id = $4 RETURNING *`,
      [price, tip_amount, payment_method, params.id]
    );

    // Update owner stats
    const total = parseFloat(price) + parseFloat(tip_amount);
    await client.query(
      `UPDATE pg_owner SET total_visits = total_visits + 1, total_spent = total_spent + $1 WHERE id = $2`,
      [total, appt.owner_id]
    );
    // Update pet last_visit
    await client.query(
      `UPDATE pg_pet SET last_visit = CURRENT_DATE WHERE id = $1`,
      [appt.pet_id]
    );

    return Response.json({ appointment: result.rows[0] });
  } finally {
    client.release();
  }
}
