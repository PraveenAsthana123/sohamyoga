import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE sm_move SET status = 'completed', actual_hours = $1, final_amount = $2, customer_rating = $3, customer_feedback = $4, balance_paid = true WHERE id = $5 RETURNING *`,
      [b.actual_hours ?? null, b.final_amount ?? null, b.customer_rating ?? null, b.customer_feedback ?? null, params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }
    // Update customer stats
    if (b.final_amount) {
      await client.query(
        `UPDATE sm_customer SET total_jobs = total_jobs + 1, total_spent = total_spent + $1 WHERE id = $2`,
        [b.final_amount, rows[0].customer_id]
      );
    }
    await client.query('COMMIT');
    return Response.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
