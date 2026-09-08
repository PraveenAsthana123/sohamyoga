import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real health/safety aggregate view -- every figure here is a live query
// against student_guardian, wellness_score, and practice_journal. No
// synthetic risk score or fabricated "wellbeing index" -- only counts and
// averages that are directly computable from real rows, with the honest
// caveat that a low mood entry is a signal to review, not a diagnosis.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [contactCoverage, wellnessDist, lowMood, activityTrend] = await Promise.all([
    query<{ total: string; with_emergency_contact: string }>(`
      SELECT count(DISTINCT s.id)::text AS total,
             count(DISTINCT sg.student_id)::text AS with_emergency_contact
      FROM student s LEFT JOIN student_guardian sg ON sg.student_id = s.id AND sg.is_emergency = true
      WHERE s.status = 'active'
    `),
    query<{ avg_composite: string | null; low_count: string; total_scored: string }>(`
      SELECT round(avg(composite_score))::text AS avg_composite,
             count(*) FILTER (WHERE composite_score < 40)::text AS low_count,
             count(DISTINCT student_id)::text AS total_scored
      FROM wellness_score WHERE score_date >= CURRENT_DATE - INTERVAL '30 days'
    `),
    query(`
      SELECT pj.student_id, s.display_name AS student_name, pj.entry_date, pj.mood_after, pj.notes
      FROM practice_journal pj JOIN student s ON s.id = pj.student_id
      WHERE pj.mood_after IS NOT NULL AND pj.mood_after <= 2 AND pj.entry_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY pj.entry_date DESC LIMIT 20
    `),
    query<{ week: string; entries: string }>(`
      SELECT date_trunc('week', entry_date)::date::text AS week, count(*)::text AS entries
      FROM practice_journal WHERE entry_date >= CURRENT_DATE - INTERVAL '8 weeks'
      GROUP BY 1 ORDER BY 1
    `),
  ]);

  const total = Number(contactCoverage.rows[0]?.total ?? 0);
  const withContact = Number(contactCoverage.rows[0]?.with_emergency_contact ?? 0);

  return Response.json({
    emergencyContactCoverage: {
      totalActiveStudents: total,
      withEmergencyContact: withContact,
      withoutEmergencyContact: total - withContact,
      coveragePct: total > 0 ? Math.round((withContact / total) * 100) : 0,
    },
    wellness: {
      avgCompositeScore30d: wellnessDist.rows[0]?.avg_composite ? Number(wellnessDist.rows[0].avg_composite) : null,
      lowScoreCount30d: Number(wellnessDist.rows[0]?.low_count ?? 0),
      totalScoredStudents30d: Number(wellnessDist.rows[0]?.total_scored ?? 0),
    },
    lowMoodFlags: lowMood.rows,
    journalActivityTrend: activityTrend.rows,
  });
}
