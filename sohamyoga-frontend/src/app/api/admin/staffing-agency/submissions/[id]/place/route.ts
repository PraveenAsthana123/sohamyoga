import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Get submission + job details
      const subRes = await client.query(
        `SELECT s.*, j.fee_amount, j.client_company_id, j.salary_max FROM sa_submission s JOIN sa_job_order j ON j.id=s.job_order_id WHERE s.id=$1`,
        [parseInt(params.id)]
      );
      if (!subRes.rows.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
      const sub = subRes.rows[0];
      const fee = body.fee_override || sub.fee_amount || (sub.offer_amount ? sub.offer_amount * 0.20 : null);
      const today = new Date().toISOString().split('T')[0];
      // Place: update submission
      await client.query(
        `UPDATE sa_submission SET status='placed', start_date=COALESCE($2,start_date), fee_invoiced=$3 WHERE id=$1`,
        [parseInt(params.id), body.start_date || today, fee]
      );
      // Fill job order
      await client.query(`UPDATE sa_job_order SET status='filled', filled_date=$1 WHERE id=$2`, [today, sub.job_order_id]);
      // Mark candidate as placed
      await client.query(`UPDATE sa_candidate SET status='placed' WHERE id=$1`, [sub.candidate_id]);
      // Update client company totals
      await client.query(
        `UPDATE sa_client_company SET total_placements=total_placements+1, total_fees_earned=total_fees_earned+COALESCE($1,0), active_job_orders=(SELECT COUNT(*) FROM sa_job_order WHERE client_company_id=$2 AND status='active') WHERE id=$2`,
        [fee, sub.client_company_id]
      );
      await client.query('COMMIT');
      const result = await client.query(`SELECT s.*, j.job_title, c.company_name, ca.first_name, ca.last_name FROM sa_submission s JOIN sa_job_order j ON j.id=s.job_order_id JOIN sa_client_company c ON c.id=j.client_company_id JOIN sa_candidate ca ON ca.id=s.candidate_id WHERE s.id=$1`, [parseInt(params.id)]);
      return NextResponse.json({ placed: result.rows[0], fee_invoiced: fee });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
