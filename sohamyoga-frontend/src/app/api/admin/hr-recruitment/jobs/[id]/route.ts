export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [job, applicants] = await Promise.all([
      client.query(`SELECT * FROM hr_job_posting WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM hr_applicant WHERE job_id=$1 ORDER BY applied_at DESC`, [params.id]),
    ]);
    if (!job.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ job: job.rows[0], applicants: applicants.rows });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const fields = ['title','department','employment_type','location','remote_ok','salary_min','salary_max','salary_type','description','requirements','nice_to_haves','noc_code','status','posted_date','closing_date','platforms'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE hr_job_posting SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ job: r.rows[0] });
  } finally {
    client.release();
  }
}
