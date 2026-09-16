export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const STATUS_ORDER = ['new','screening','phone_screen','interview','assessment','offer','hired','rejected','withdrawn'];

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('job_id');
  const status = searchParams.get('status');
  const rating = searchParams.get('rating');
  const source = searchParams.get('source');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (jobId) { where.push(`a.job_id=$${i++}`); params.push(jobId); }
    if (status) { where.push(`a.status=$${i++}`); params.push(status); }
    if (rating) { where.push(`a.rating>=$${i++}`); params.push(rating); }
    if (source) { where.push(`a.source=$${i++}`); params.push(source); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT a.*, j.title AS job_title
      FROM hr_applicant a
      LEFT JOIN hr_job_posting j ON j.id=a.job_id
      ${wStr}
      ORDER BY
        CASE a.status ${STATUS_ORDER.map((s, idx) => `WHEN '${s}' THEN ${idx}`).join(' ')} ELSE 99 END,
        a.applied_at DESC
      LIMIT 300
    `, params);

    return Response.json({ applicants: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { job_id, name, email, phone, location, current_title, years_experience,
      education_level, skills, resume_url, cover_letter, source, notes } = body;

    if (!name) return Response.json({ error: 'name required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO hr_applicant (job_id,name,email,phone,location,current_title,years_experience,
        education_level,skills,resume_url,cover_letter,source,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [job_id,name,email,phone,location,current_title,years_experience,
        education_level,skills||[],resume_url,cover_letter,source,notes]);

    // Update job applicant count
    if (job_id) {
      await client.query(`UPDATE hr_job_posting SET applications_count=applications_count+1 WHERE id=$1`, [job_id]);
    }

    return Response.json({ applicant: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
