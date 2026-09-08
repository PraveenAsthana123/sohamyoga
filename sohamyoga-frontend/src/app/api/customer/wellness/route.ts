import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real wellness_score history, computed by WellnessScoreComputeJob from
// actual practice_journal entries -- never fabricated. Report: a 30-day
// average, real (0 if no scores exist yet, never a placeholder number).
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ scores: [], averageComposite: 0, hasStudentRecord: false });

  const scores = await query<{ score_date: string; mood_score: number | null; energy_score: number | null; composite_score: number }>(
    `SELECT score_date::text, mood_score, energy_score, composite_score FROM wellness_score
     WHERE student_id = $1 ORDER BY score_date DESC LIMIT 30`,
    [student.id],
  );
  const avg = scores.rows.length
    ? Math.round(scores.rows.reduce((sum, s) => sum + s.composite_score, 0) / scores.rows.length)
    : 0;

  return Response.json({ scores: scores.rows, averageComposite: avg, hasStudentRecord: true });
}
