import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// Real teacher/admin authoring for personalized_plan -- previously this
// table had zero write surface anywhere in the codebase (confirmed via
// grep), so every real customer's /customer/plan page showed "No active
// plan yet" permanently. This is the fix: a teacher can now actually
// create a plan for a student.
export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const studentId = req.nextUrl.searchParams.get('studentId');
  const plans = await query(
    `SELECT p.id, p.student_id, s.display_name AS student_name, p.name, p.description, p.focus_areas,
            p.weekly_sessions, p.session_minutes, p.difficulty, p.is_ai_generated, p.is_active, p.starts_on, p.ends_on, p.created_at,
            (SELECT count(*) FROM plan_pose pp WHERE pp.plan_id = p.id)::int AS pose_count
     FROM personalized_plan p JOIN student s ON s.id = p.student_id
     WHERE ($1::uuid IS NULL OR p.student_id = $1)
     ORDER BY p.created_at DESC LIMIT 200`,
    [studentId],
  );
  return Response.json({ plans: plans.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    studentId?: string; name?: string; description?: string; focusAreas?: string[];
    weeklySessions?: number; sessionMinutes?: number; difficulty?: string; startsOn?: string; endsOn?: string;
  } | null;
  if (!body?.studentId || !body.name?.trim()) {
    return Response.json({ error: 'studentId and name are required.' }, { status: 400 });
  }
  if (body.difficulty && !DIFFICULTIES.includes(body.difficulty)) {
    return Response.json({ error: `difficulty must be one of ${DIFFICULTIES.join('|')}.` }, { status: 400 });
  }

  const student = await query<{ tenant_id: string }>(`SELECT tenant_id FROM student WHERE id = $1`, [body.studentId]);
  if (!student.rowCount) return Response.json({ error: 'Student not found.' }, { status: 404 });

  const result = await query(
    `INSERT INTO personalized_plan (tenant_id, student_id, name, description, focus_areas, weekly_sessions, session_minutes, difficulty, is_ai_generated, created_by, starts_on, ends_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,$11) RETURNING *`,
    [
      student.rows[0].tenant_id, body.studentId, body.name.trim(), body.description || null, body.focusAreas ?? [],
      body.weeklySessions ?? 3, body.sessionMinutes ?? 60, body.difficulty ?? 'beginner',
      principal!.id, body.startsOn || null, body.endsOn || null,
    ],
  );
  return Response.json({ plan: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { id?: string; isActive?: boolean } | null;
  if (!body?.id || typeof body.isActive !== 'boolean') return Response.json({ error: 'id and isActive are required.' }, { status: 400 });

  const result = await query(`UPDATE personalized_plan SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING *`, [body.isActive, body.id]);
  if (!result.rowCount) return Response.json({ error: 'Plan not found.' }, { status: 404 });
  return Response.json({ plan: result.rows[0] });
}

export async function DELETE(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id query param is required.' }, { status: 400 });
  const result = await query(`DELETE FROM personalized_plan WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Plan not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
