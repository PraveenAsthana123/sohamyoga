import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEVELS = ['exploring', 'learning', 'practising', 'proficient', 'master'];

// Real teacher assessment-entry for pose_assessment -- previously this
// table had zero write surface anywhere in the codebase, so every real
// customer's /customer/pose-mastery page showed an honestly-empty state
// permanently. This closes that gap.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const studentId = req.nextUrl.searchParams.get('studentId');
  const assessments = await query(
    `SELECT pa.id, pa.student_id, s.display_name AS student_name, pa.asana_id, a.english_name, a.sanskrit_name,
            pa.mastery_level, pa.teacher_notes, pa.assessed_at
     FROM pose_assessment pa JOIN student s ON s.id = pa.student_id JOIN asana a ON a.id = pa.asana_id
     WHERE ($1::uuid IS NULL OR pa.student_id = $1)
     ORDER BY pa.assessed_at DESC LIMIT 200`,
    [studentId],
  );
  return Response.json({ assessments: assessments.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    studentId?: string; asanaId?: string; masteryLevel?: string; teacherNotes?: string;
  } | null;
  if (!body?.studentId || !body.asanaId || !body.masteryLevel) {
    return Response.json({ error: 'studentId, asanaId and masteryLevel are required.' }, { status: 400 });
  }
  if (!LEVELS.includes(body.masteryLevel)) {
    return Response.json({ error: `masteryLevel must be one of ${LEVELS.join('|')}.` }, { status: 400 });
  }

  const student = await query<{ tenant_id: string }>(`SELECT tenant_id FROM student WHERE id = $1`, [body.studentId]);
  if (!student.rowCount) return Response.json({ error: 'Student not found.' }, { status: 404 });

  const result = await query(
    `INSERT INTO pose_assessment (tenant_id, student_id, asana_id, mastery_level, teacher_notes, assessed_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, asana_id) DO UPDATE SET mastery_level = EXCLUDED.mastery_level, teacher_notes = EXCLUDED.teacher_notes, assessed_by = EXCLUDED.assessed_by, assessed_at = now(), updated_at = now()
     RETURNING *`,
    [student.rows[0].tenant_id, body.studentId, body.asanaId, body.masteryLevel, body.teacherNotes || null, principal!.id],
  );
  return Response.json({ assessment: result.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id query param is required.' }, { status: 400 });
  const result = await query(`DELETE FROM pose_assessment WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Assessment not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
