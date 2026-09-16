export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const dept = searchParams.get('department');
  const type = searchParams.get('employment_type');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (status) { where.push(`status=$${i++}`); params.push(status); }
    if (dept) { where.push(`department ILIKE $${i++}`); params.push(`%${dept}%`); }
    if (type) { where.push(`employment_type=$${i++}`); params.push(type); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT j.*,
        (CURRENT_DATE - posted_date) AS days_open,
        (SELECT COUNT(*) FROM hr_applicant WHERE job_id=j.id) AS total_applicants
      FROM hr_job_posting j ${wStr}
      ORDER BY j.created_at DESC LIMIT 200
    `, params);

    return Response.json({ jobs: rows.rows });
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
    const { title, department, employment_type, location, remote_ok, salary_min, salary_max, salary_type,
      description, requirements, nice_to_haves, noc_code, status, posted_date, closing_date, platforms } = body;

    if (!title) return Response.json({ error: 'title required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO hr_job_posting (title,department,employment_type,location,remote_ok,salary_min,salary_max,salary_type,
        description,requirements,nice_to_haves,noc_code,status,posted_date,closing_date,platforms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [title,department,employment_type||'full_time',location||'Calgary, AB',remote_ok||false,
        salary_min,salary_max,salary_type||'annual',description,requirements||[],nice_to_haves||[],
        noc_code,status||'draft',posted_date,closing_date,platforms||[]]);

    return Response.json({ job: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
