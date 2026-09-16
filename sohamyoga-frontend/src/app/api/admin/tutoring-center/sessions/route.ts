import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const tutor = searchParams.get('tutor') || '';
  const student_id = searchParams.get('student_id') || '';
  const status = searchParams.get('status') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT s.*, st.first_name, st.last_name, st.grade_level, st.parent_email
        FROM tc_session s
        LEFT JOIN tc_student st ON st.id=s.student_id
        WHERE ($1='' OR s.session_date=$1::date)
          AND ($2='' OR s.tutor ILIKE $2)
          AND ($3='' OR s.student_id=$3::integer)
          AND ($4='' OR s.status=$4)
        ORDER BY s.session_date, s.start_time
      `, [date, `%${tutor}%`, student_id, status]);
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
        INSERT INTO tc_session (student_id, tutor, session_date, start_time, end_time, subject, amount_billed)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [
        body.student_id, body.tutor, body.session_date,
        body.start_time, body.end_time, body.subject,
        body.amount_billed || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
