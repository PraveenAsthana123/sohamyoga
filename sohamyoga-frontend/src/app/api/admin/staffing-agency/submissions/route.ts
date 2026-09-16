import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const job_order_id = searchParams.get('job_order_id');
    const candidate_id = searchParams.get('candidate_id');
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT s.*, ca.first_name, ca.last_name, ca.email, ca.current_title, j.job_title, c.company_name FROM sa_submission s JOIN sa_candidate ca ON ca.id=s.candidate_id JOIN sa_job_order j ON j.id=s.job_order_id JOIN sa_client_company c ON c.id=j.client_company_id WHERE 1=1`;
      const params: any[] = [];
      if (job_order_id) { params.push(parseInt(job_order_id)); q += ` AND s.job_order_id=$${params.length}`; }
      if (candidate_id) { params.push(parseInt(candidate_id)); q += ` AND s.candidate_id=$${params.length}`; }
      if (status) { params.push(status); q += ` AND s.status=$${params.length}`; }
      q += ` ORDER BY s.submitted_at DESC`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Prevent duplicate submission for same job+candidate
      const dup = await client.query(`SELECT id FROM sa_submission WHERE job_order_id=$1 AND candidate_id=$2`, [body.job_order_id, body.candidate_id]);
      if (dup.rows.length) return NextResponse.json({ error: 'Candidate already submitted for this job order', existing_id: dup.rows[0].id }, { status: 409 });
      const { rows } = await client.query(
        `INSERT INTO sa_submission (job_order_id, candidate_id, submitted_by, status, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [body.job_order_id, body.candidate_id, body.submitted_by||null, body.status||'submitted', body.notes||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
