import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const work_auth = searchParams.get('work_authorization');
    const availability = searchParams.get('availability');
    const skills = searchParams.get('skills');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT * FROM sa_candidate WHERE 1=1`;
      const params: any[] = [];
      if (work_auth) { params.push(work_auth); q += ` AND work_authorization=$${params.length}`; }
      if (availability) { params.push(availability); q += ` AND availability=$${params.length}`; }
      if (skills) { params.push(`%${skills}%`); q += ` AND skills::text ILIKE $${params.length}`; }
      q += ` ORDER BY created_at DESC`;
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
      const { rows } = await client.query(
        `INSERT INTO sa_candidate (first_name, last_name, email, phone, city, province, current_title, current_employer, years_experience, highest_education, desired_salary_min, desired_salary_max, work_authorization, availability, skills, certifications, industries, resume_url, linkedin_url, source, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
        [body.first_name, body.last_name, body.email, body.phone||null, body.city||'Calgary', body.province||'AB', body.current_title||null, body.current_employer||null, body.years_experience||0, body.highest_education||null, body.desired_salary_min||null, body.desired_salary_max||null, body.work_authorization||'canadian_citizen', body.availability||'immediately', body.skills||[], body.certifications||[], body.industries||[], body.resume_url||null, body.linkedin_url||null, body.source||'other', body.status||'active', body.notes||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
