import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT a.*, s.first_name, s.last_name, s.grade_level AS student_grade
        FROM tc_assessment a
        LEFT JOIN tc_student s ON s.id=a.student_id
        WHERE ($1='' OR a.student_id=$1::integer)
        ORDER BY a.assessment_date DESC
      `, [student_id]);
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
        INSERT INTO tc_assessment (student_id, assessment_date, assessed_by, subject, grade_level, strengths, weaknesses, recommended_focus, current_grade_estimate, target_grade, recommended_sessions_per_week, assessment_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
      `, [
        body.student_id, body.assessment_date || new Date().toISOString().split('T')[0],
        body.assessed_by || null, body.subject, body.grade_level || null,
        body.strengths || [], body.weaknesses || [],
        body.recommended_focus || null, body.current_grade_estimate || null,
        body.target_grade || null, body.recommended_sessions_per_week || 1,
        body.assessment_notes || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
