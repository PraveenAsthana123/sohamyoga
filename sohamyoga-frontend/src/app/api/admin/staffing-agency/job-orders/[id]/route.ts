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
      const [jobRes, subsRes] = await Promise.all([
        client.query(`SELECT j.*, c.company_name FROM sa_job_order j JOIN sa_client_company c ON c.id=j.client_company_id WHERE j.id=$1`, [parseInt(params.id)]),
        client.query(`SELECT s.*, ca.first_name, ca.last_name, ca.email, ca.current_title FROM sa_submission s JOIN sa_candidate ca ON ca.id=s.candidate_id WHERE s.job_order_id=$1 ORDER BY s.submitted_at DESC`, [parseInt(params.id)]),
      ]);
      if (!jobRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...jobRes.rows[0], submissions: subsRes.rows });
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
      if (body.status === 'filled' && !body.filled_date) body.filled_date = new Date().toISOString().split('T')[0];
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(', ');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE sa_job_order SET ${sets} WHERE id=$1 RETURNING *`, [parseInt(params.id), ...vals]);
      if (rows.length) {
        await client.query(`UPDATE sa_client_company SET active_job_orders=(SELECT COUNT(*) FROM sa_job_order WHERE client_company_id=$1 AND status='active') WHERE id=$1`, [rows[0].client_company_id]);
      }
      return NextResponse.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const jobRes = await client.query(`SELECT client_company_id FROM sa_job_order WHERE id=$1`, [parseInt(params.id)]);
      await client.query(`DELETE FROM sa_job_order WHERE id=$1`, [parseInt(params.id)]);
      if (jobRes.rows.length) {
        await client.query(`UPDATE sa_client_company SET active_job_orders=(SELECT COUNT(*) FROM sa_job_order WHERE client_company_id=$1 AND status='active') WHERE id=$1`, [jobRes.rows[0].client_company_id]);
      }
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
