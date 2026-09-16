import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const db = await pool.connect();
    try {
      // Mark quote as accepted
      const { rows: qRows } = await db.query(`UPDATE trade_quote SET status='accepted' WHERE id=$1 RETURNING *`, [params.id]);
      if (!qRows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      const q = qRows[0];
      // Create or update linked job
      const jobNum = `JOB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const { rows: jRows } = await db.query(
        `INSERT INTO trade_job (client_id,job_number,title,trade_type,quoted_amount,status)
         VALUES($1,$2,$3,$4,$5,'approved') RETURNING *`,
        [q.client_id, jobNum, q.title, q.trade_type, q.total]
      );
      // Link quote to job
      await db.query(`UPDATE trade_quote SET job_id=$1 WHERE id=$2`, [jRows[0].id, params.id]);
      return Response.json({ quote: q, job: jRows[0] });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
