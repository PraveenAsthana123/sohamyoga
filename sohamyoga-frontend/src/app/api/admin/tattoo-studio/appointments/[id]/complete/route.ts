import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { total_amount, client_rating } = body;

  if (total_amount === undefined) {
    return NextResponse.json({ error: 'total_amount required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get appointment details
    const { rows: appts } = await client.query(
      'SELECT * FROM ts_appointment WHERE id = $1', [params.id]
    );
    if (!appts.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Not found' }, { status: 404 }); }

    const appt = appts[0];
    const balance_due = Math.max(0, total_amount - (appt.deposit_paid ? Number(appt.deposit_amount) : 0));

    const { rows } = await client.query(
      `UPDATE ts_appointment SET
        status = 'completed',
        total_amount = $1,
        balance_due = $2,
        aftercare_instructions_given = true,
        client_rating = COALESCE($3, client_rating)
       WHERE id = $4 RETURNING *`,
      [total_amount, balance_due, client_rating || null, params.id]
    );

    // Update client totals
    await client.query(
      `UPDATE ts_client SET
        total_sessions = total_sessions + 1,
        total_spent = total_spent + $1
       WHERE id = $2`,
      [total_amount, appt.client_id]
    );

    await client.query('COMMIT');
    return NextResponse.json({ appointment: rows[0], balance_due });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
