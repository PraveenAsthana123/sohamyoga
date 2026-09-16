import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { npsCategory } from '@/cron/jobs/NpsCalculationJob';
import { csatCategory } from '@/cron/jobs/CsatCalculationJob';
import { cesCategory } from '@/cron/jobs/CesCalculationJob';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CX Dashboard -- real NPS/CSAT/CES from survey_analytics, plus live
// support_ticket, service_review, chat_conversation, voice_call_log counts.
// Tables that may not exist in all deployments use .catch(() => ...).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  // --- Survey analytics (NPS/CSAT/CES) ---
  const rows = await query<{
    survey_id: string; title: string; type: string; total_responses: number; completed_responses: number;
    completion_rate: string; nps_score: string | null; csat_score: string | null; ces_score: string | null; calculated_at: string;
  }>(
    `SELECT sa.survey_id, s.title, s.type, sa.total_responses, sa.completed_responses,
            sa.completion_rate, sa.nps_score, sa.csat_score, sa.ces_score, sa.calculated_at
     FROM survey_analytics sa JOIN survey s ON s.id = sa.survey_id
     WHERE sa.nps_score IS NOT NULL OR sa.csat_score IS NOT NULL OR sa.ces_score IS NOT NULL
     ORDER BY sa.calculated_at DESC`,
  ).catch(() => ({ rows: [] as { survey_id: string; title: string; type: string; total_responses: number; completed_responses: number; completion_rate: string; nps_score: string | null; csat_score: string | null; ces_score: string | null; calculated_at: string }[] }));

  const surveys = rows.rows.map(r => ({
    surveyId: r.survey_id, title: r.title, type: r.type, totalResponses: r.total_responses,
    completedResponses: r.completed_responses, completionRate: Number(r.completion_rate),
    npsScore: r.nps_score !== null ? Number(r.nps_score) : null,
    npsCategory: r.nps_score !== null ? npsCategory(Number(r.nps_score)) : null,
    csatScore: r.csat_score !== null ? Number(r.csat_score) : null,
    csatCategory: r.csat_score !== null ? csatCategory(Number(r.csat_score)) : null,
    cesScore: r.ces_score !== null ? Number(r.ces_score) : null,
    cesCategory: r.ces_score !== null ? cesCategory(Number(r.ces_score)) : null,
    calculatedAt: r.calculated_at,
  }));

  const npsSurveys = surveys.filter(s => s.npsScore !== null);
  const csatSurveys = surveys.filter(s => s.csatScore !== null);
  const cesSurveys = surveys.filter(s => s.cesScore !== null);
  const overallNps = npsSurveys.length ? Math.round((npsSurveys.reduce((sum, s) => sum + (s.npsScore ?? 0), 0) / npsSurveys.length) * 100) / 100 : null;
  const overallCsat = csatSurveys.length ? Math.round((csatSurveys.reduce((sum, s) => sum + (s.csatScore ?? 0), 0) / csatSurveys.length) * 100) / 100 : null;
  const overallCes = cesSurveys.length ? Math.round((cesSurveys.reduce((sum, s) => sum + (s.cesScore ?? 0), 0) / cesSurveys.length) * 100) / 100 : null;

  // --- Live cross-channel counts (graceful fallback if table missing) ---
  const client = await pool.connect();
  try {
    const [ticketCounts, reviewStats, chatCounts, voiceCounts, recentReviews] = await Promise.all([
      client
        .query<{ open: string; resolved_today: string; total: string }>(
          `SELECT
             count(*) FILTER (WHERE status IN ('open','in_progress','pending_customer'))::text AS open,
             count(*) FILTER (WHERE resolved_at::date = current_date)::text AS resolved_today,
             count(*)::text AS total
           FROM support_ticket`,
        )
        .catch(() => ({ rows: [{ open: '0', resolved_today: '0', total: '0' }] })),
      client
        .query<{ avg_rating: string; total: string; pending: string }>(
          `SELECT
             round(avg(star_rating)::numeric, 2)::text AS avg_rating,
             count(*)::text AS total,
             count(*) FILTER (WHERE status = 'pending')::text AS pending
           FROM service_review`,
        )
        .catch(() => ({ rows: [{ avg_rating: '0', total: '0', pending: '0' }] })),
      client
        .query<{ total: string; open: string; resolved: string }>(
          `SELECT
             count(*)::text AS total,
             count(*) FILTER (WHERE status IN ('pending','active'))::text AS open,
             count(*) FILTER (WHERE status = 'resolved')::text AS resolved
           FROM chat_conversation`,
        )
        .catch(() => ({ rows: [{ total: '0', open: '0', resolved: '0' }] })),
      client
        .query<{ total: string; inbound: string; outbound: string }>(
          `SELECT
             count(*)::text AS total,
             count(*) FILTER (WHERE direction = 'inbound')::text AS inbound,
             count(*) FILTER (WHERE direction = 'outbound')::text AS outbound
           FROM voice_call_log`,
        )
        .catch(() => ({ rows: [{ total: '0', inbound: '0', outbound: '0' }] })),
      client
        .query<{
          id: string; reviewer_name: string; reviewer_email: string;
          star_rating: number; comment: string; status: string; created_at: string;
        }>(
          `SELECT id, reviewer_name, reviewer_email, star_rating, comment, status, created_at
           FROM service_review
           ORDER BY created_at DESC LIMIT 20`,
        )
        .catch(() => ({ rows: [] as { id: string; reviewer_name: string; reviewer_email: string; star_rating: number; comment: string; status: string; created_at: string }[] })),
    ]);

    return Response.json({
      surveys,
      overallNps,
      overallCsat,
      overallCes,
      cesTracked: cesSurveys.length > 0,
      tickets: ticketCounts.rows[0] ?? { open: '0', resolved_today: '0', total: '0' },
      reviews: {
        ...(reviewStats.rows[0] ?? { avg_rating: '0', total: '0', pending: '0' }),
        recent: recentReviews.rows,
      },
      chat: chatCounts.rows[0] ?? { total: '0', open: '0', resolved: '0' },
      voice: voiceCounts.rows[0] ?? { total: '0', inbound: '0', outbound: '0' },
    });
  } finally {
    client.release();
  }
}
