import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEVEL_ORDER = ['exploring', 'learning', 'practising', 'proficient', 'master'];

// Read-only view of pose_assessment (teacher-assessed) plus a real report:
// mastery-level distribution across the student's assessed poses. assessed_by
// is a teacher user_id -- a customer views their assessments, they don't
// self-report mastery.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ assessments: [], report: {}, hasStudentRecord: false });

  const assessments = await query(
    `SELECT pa.mastery_level, pa.teacher_notes, pa.assessed_at, a.sanskrit_name, a.english_name, a.difficulty_level, a.image_url
     FROM pose_assessment pa JOIN asana a ON a.id = pa.asana_id
     WHERE pa.student_id = $1 ORDER BY pa.assessed_at DESC`,
    [student.id],
  );

  const report: Record<string, number> = Object.fromEntries(LEVEL_ORDER.map(l => [l, 0]));
  for (const row of assessments.rows as { mastery_level: string }[]) report[row.mastery_level] = (report[row.mastery_level] ?? 0) + 1;

  return Response.json({ assessments: assessments.rows, report, hasStudentRecord: true });
}
