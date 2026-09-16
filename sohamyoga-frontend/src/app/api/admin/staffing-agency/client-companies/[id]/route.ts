import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [compRes, ordersRes, subsRes] = await Promise.all([
        client.query(`SELECT * FROM sa_client_company WHERE id=$1`, [parseInt(params.id)]),
        client.query(`SELECT j.*, (SELECT COUNT(*) FROM sa_submission s WHERE s.job_order_id=j.id) AS submission_count FROM sa_job_order j WHERE j.client_company_id=$1 ORDER BY j.created_at DESC`, [parseInt(params.id)]),
        client.query(`SELECT COUNT(*) AS total_submissions FROM sa_submission s JOIN sa_job_order j ON j.id=s.job_order_id WHERE j.client_company_id=$1`, [parseInt(params.id)]),
      ]);
      if (!compRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...compRes.rows[0], job_orders: ordersRes.rows, total_submissions: parseInt(subsRes.rows[0].total_submissions) });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(', ');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE sa_client_company SET ${sets} WHERE id=$1 RETURNING *`, [parseInt(params.id), ...vals]);
      return NextResponse.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
