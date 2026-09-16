export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const STATUS_ORDER = ['new','screening','phone_screen','interview','assessment','offer','hired','rejected','withdrawn'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [applicant, interviews] = await Promise.all([
      client.query(`SELECT a.*, j.title AS job_title FROM hr_applicant a LEFT JOIN hr_job_posting j ON j.id=a.job_id WHERE a.id=$1`, [params.id]),
      client.query(`SELECT * FROM hr_interview WHERE applicant_id=$1 ORDER BY scheduled_at DESC`, [params.id]),
    ]);
    if (!applicant.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ applicant: applicant.rows[0], interviews: interviews.rows });
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

    // Handle advance action
    if (body.advance) {
      const current = await client.query(`SELECT status FROM hr_applicant WHERE id=$1`, [params.id]);
      const idx = STATUS_ORDER.indexOf(current.rows[0]?.status || 'new');
      const nextStatus = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.indexOf('hired'))];
      const r = await client.query(`UPDATE hr_applicant SET status=$1 WHERE id=$2 RETURNING *`, [nextStatus, params.id]);
      return Response.json({ applicant: r.rows[0], newStatus: nextStatus });
    }

    const fields = ['status','rating','notes','current_title','years_experience','skills','resume_url'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE hr_applicant SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ applicant: r.rows[0] });
  } finally {
    client.release();
  }
}
