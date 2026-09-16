import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || '';
  const grade = searchParams.get('grade') || '';
  const status = searchParams.get('status') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM tc_student
        WHERE ($1='' OR $1 = ANY(subjects_needed))
          AND ($2='' OR grade_level ILIKE $2)
          AND ($3='' OR status=$3)
        ORDER BY last_name, first_name
      `, [subject, `%${grade}%`, status]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO tc_student (first_name, last_name, email, phone, parent_name, parent_phone, parent_email, grade_level, school, school_board, subjects_needed, learning_goals, learning_challenges, iep_student, preferred_tutor, session_type, session_frequency, hourly_rate, monthly_package_rate, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *
      `, [
        body.first_name, body.last_name, body.email || null, body.phone || null,
        body.parent_name || null, body.parent_phone || null, body.parent_email || null,
        body.grade_level, body.school || null, body.school_board || 'CBE',
        body.subjects_needed || [],
        body.learning_goals || null, body.learning_challenges || null,
        body.iep_student || false, body.preferred_tutor || null,
        body.session_type || 'in_person', body.session_frequency || 'weekly',
        body.hourly_rate || null, body.monthly_package_rate || null,
        body.notes || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
