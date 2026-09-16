export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const week = searchParams.get('week'); // ISO week start date

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (week) {
      where.push(`hi.scheduled_at >= $${i++}::date AND hi.scheduled_at < $${i++}::date + INTERVAL '7 days'`);
      params.push(week, week);
    } else {
      // Default: upcoming 30 days
      where.push(`hi.scheduled_at >= NOW() - INTERVAL '1 day' AND hi.scheduled_at <= NOW() + INTERVAL '30 days'`);
    }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT hi.*, ha.name AS applicant_name, ha.current_title, ha.job_id,
        j.title AS job_title
      FROM hr_interview hi
      LEFT JOIN hr_applicant ha ON ha.id = hi.applicant_id
      LEFT JOIN hr_job_posting j ON j.id = ha.job_id
      ${wStr}
      ORDER BY hi.scheduled_at ASC
      LIMIT 200
    `, params);

    return Response.json({ interviews: rows.rows });
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
    const { applicant_id, interview_type, scheduled_at, duration_minutes, interviewer, location, notes } = body;

    if (!applicant_id || !scheduled_at) {
      return Response.json({ error: 'applicant_id and scheduled_at required' }, { status: 400 });
    }

    const r = await client.query(`
      INSERT INTO hr_interview (applicant_id, interview_type, scheduled_at, duration_minutes, interviewer, location)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [applicant_id, interview_type || 'phone', scheduled_at, duration_minutes || 60, interviewer, location || notes]);

    return Response.json({ interview: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
