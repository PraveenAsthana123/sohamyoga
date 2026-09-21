import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await req.json();

    const job = await client.query(`SELECT * FROM hs_job WHERE id = $1 FOR UPDATE`, [params.id]);
    if (!job.rows[0]) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }

    const updated = await client.query(
      `UPDATE hs_job SET status='completed', payment_status=COALESCE($1,payment_status), customer_rating=COALESCE($2,customer_rating), customer_feedback=COALESCE($3,customer_feedback), tip_amount=COALESCE($4,tip_amount), checklist_completed=true WHERE id=$5 RETURNING *`,
      [b.payment_status ?? 'paid', b.customer_rating, b.customer_feedback, b.tip_amount, params.id]
    );

    await client.query(
      `UPDATE hs_customer SET total_jobs = total_jobs + 1, total_spent = total_spent + $1 WHERE id = $2`,
      [parseFloat(job.rows[0].price) + parseFloat(b.tip_amount ?? 0), job.rows[0].customer_id]
    );

    await client.query('COMMIT');
    return Response.json(updated.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(e) }, { status: 500 });
  } finally { client.release(); }
}
