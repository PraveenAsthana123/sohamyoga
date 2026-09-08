import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';

const TYPES = new Set(['pre_meeting_brief', 'post_meeting_report']);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const result = await query(`SELECT * FROM meeting_report ORDER BY updated_at DESC LIMIT 250`);
  return Response.json({ reports: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const reportType = String(body?.reportType ?? '');
  const customerName = String(body?.customerName ?? '').trim();
  const title = String(body?.title ?? '').trim();
  if (!TYPES.has(reportType) || !customerName || !title) return Response.json({ error: 'reportType, customerName, and title are required.' }, { status: 400 });
  const sections = reportType === 'pre_meeting_brief'
    ? { executiveBrief: '', customerContext: '', marketSignals: '', competitorAndPricing: '', risks: '', questions: '', recommendedNextStep: '' }
    : { executiveSummary: '', meetingNotes: '', needsAndObjections: '', decisions: '', competitorAndPricing: '', recommendations: '', followUpPlan: '' };
  const result = await query<{ id: string }>(`INSERT INTO meeting_report
    (study_id,report_type,title,customer_name,meeting_at,objective,sections) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
    [body?.studyId || null, reportType, title, customerName, body?.meetingAt || null, String(body?.objective ?? ''), JSON.stringify(sections)]);
  await query(`INSERT INTO meeting_report_event (report_id,event_type,detail) VALUES ($1,'created',$2::jsonb)`, [result.rows[0].id, JSON.stringify({ reportType })]);
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
