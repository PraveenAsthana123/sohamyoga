import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real advocacy_score rows from the latest AdvocacyScoreJob run. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    student_id: string; display_name: string; nps_score: string | null; attendance_count: number;
    retention_days: number; referral_count: number; has_recent_problem: boolean;
    composite_score: string; eligibility: string; ai_note: string | null; computed_at: string;
  }>(
    `SELECT a.student_id, s.display_name, a.nps_score, a.attendance_count, a.retention_days,
            a.referral_count, a.has_recent_problem, a.composite_score, a.eligibility, a.ai_note, a.computed_at
     FROM advocacy_score a
     JOIN student s ON s.id = a.student_id
     ORDER BY a.composite_score DESC`,
  );

  if (!result.rowCount) {
    return Response.json({ hasData: false, scores: [] });
  }

  return Response.json({
    hasData: true,
    scores: result.rows.map(r => ({
      studentId: r.student_id,
      name: r.display_name,
      npsScore: r.nps_score ? Number(r.nps_score) : null,
      attendanceCount: r.attendance_count,
      retentionDays: r.retention_days,
      referralCount: r.referral_count,
      hasRecentProblem: r.has_recent_problem,
      compositeScore: Number(r.composite_score),
      eligibility: r.eligibility,
      aiNote: r.ai_note,
      computedAt: r.computed_at,
    })),
    eligibleForAskCount: result.rows.filter(r => r.eligibility === 'strong_candidate').length,
  });
}
