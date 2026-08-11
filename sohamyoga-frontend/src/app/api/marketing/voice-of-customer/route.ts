// GET /api/marketing/voice-of-customer — real weekly digests from
// VoiceOfCustomerJob, for the admin CRM page's Voice of Customer panel.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100);
  const rows = await query<{
    id: string; period_start: string; period_end: string; source_message_count: number;
    themes: { label: string; count: number; sentiment: string }[];
    top_complaints: string[]; top_requests: string[]; overall_summary: string; status: string; created_at: string;
  }>(
    `SELECT id, period_start, period_end, source_message_count, themes, top_complaints, top_requests, overall_summary, status, created_at
     FROM voice_of_customer_digest ORDER BY period_start DESC LIMIT $1`,
    [limit],
  );

  return Response.json({
    digests: rows.rows.map(r => ({
      id: r.id, periodStart: r.period_start, periodEnd: r.period_end, sourceMessageCount: r.source_message_count,
      themes: r.themes, topComplaints: r.top_complaints, topRequests: r.top_requests,
      overallSummary: r.overall_summary, status: r.status, createdAt: r.created_at,
    })),
  });
}
