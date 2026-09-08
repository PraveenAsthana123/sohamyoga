import { NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireAdmin } from '../../../../../lib/session-auth';
import { query } from '../../../../../lib/postgres';

// Real PDF export for meeting_report -- the schema/CRUD/create-UI already
// existed (short pre_meeting_brief / long post_meeting_report templates)
// but nothing anywhere in this codebase had ever generated a real
// document from one, despite meeting_report_event already tracking an
// 'export_requested' event type for exactly this. This is that missing
// piece. Renders whatever the admin has actually filled in -- an
// honestly-empty section prints as "(not filled in yet)", never invented.

const SECTION_LABELS: Record<string, string> = {
  executiveBrief: 'Executive Brief', customerContext: 'Customer Context', marketSignals: 'Market Signals',
  competitorAndPricing: 'Competitor & Pricing', risks: 'Risks', questions: 'Questions to Ask', recommendedNextStep: 'Recommended Next Step',
  executiveSummary: 'Executive Summary', meetingNotes: 'Meeting Notes', needsAndObjections: 'Needs & Objections',
  decisions: 'Decisions', recommendations: 'Recommendations', followUpPlan: 'Follow-Up Plan',
};

interface ReportRow {
  id: string; report_type: string; title: string; customer_name: string; meeting_at: string | null; status: string;
  objective: string; participants: string[]; sections: Record<string, string>; evidence: { label: string; url?: string }[];
  action_items: { text: string; owner?: string; due?: string }[]; created_at: string; updated_at: string;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await context.params;

  const result = await query<ReportRow>(`SELECT * FROM meeting_report WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Report not found.' }, { status: 404 });
  const r = result.rows[0];

  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const ensureSpace = (needed: number) => { if (y - needed < 50) { page = doc.addPage([595, 842]); y = 800; } };
  const wrap = (text: string, maxChars: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.length ? lines : [''];
  };
  const draw = (text: string, opts: { size?: number; f?: typeof font; indent?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 11;
    ensureSpace(size + 8);
    page.drawText(text, { x: 50 + (opts.indent ?? 0), y, size, font: opts.f ?? font, color: rgb(...(opts.color ?? [0.15, 0.15, 0.15])) });
    y -= size + 8;
  };
  const drawWrapped = (text: string, opts: { size?: number; indent?: number; color?: [number, number, number] } = {}) => {
    for (const line of wrap(text, 90)) draw(line, opts);
  };
  const heading = (text: string) => { y -= 6; draw(text, { size: 14, f: bold, color: [0.1, 0.2, 0.4] }); y -= 2; };

  const isShort = r.report_type === 'pre_meeting_brief';
  draw(isShort ? 'Pre-Meeting Briefing' : 'Post-Meeting Detailed Report', { size: 20, f: bold });
  draw(r.title, { size: 13, color: [0.3, 0.3, 0.3] });
  draw(`Customer: ${r.customer_name}${r.meeting_at ? ` · Meeting: ${new Date(r.meeting_at).toLocaleString()}` : ''}`, { size: 10, color: [0.4, 0.4, 0.4] });
  draw(`Status: ${r.status} · Generated ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: [0.6, 0.6, 0.6] });

  if (r.objective) { heading('Objective'); drawWrapped(r.objective); }

  const sectionOrder = isShort
    ? ['executiveBrief', 'customerContext', 'marketSignals', 'competitorAndPricing', 'risks', 'questions', 'recommendedNextStep']
    : ['executiveSummary', 'meetingNotes', 'needsAndObjections', 'decisions', 'competitorAndPricing', 'recommendations', 'followUpPlan'];
  for (const key of sectionOrder) {
    heading(SECTION_LABELS[key] ?? key);
    const value = r.sections?.[key];
    if (value && value.trim()) drawWrapped(value);
    else draw('(not filled in yet)', { color: [0.6, 0.6, 0.6], size: 10 });
  }

  if (r.participants?.length) {
    heading('Participants');
    for (const p of r.participants) draw(`• ${p}`, { indent: 10 });
  }
  if (r.evidence?.length) {
    heading('Evidence');
    for (const e of r.evidence) draw(`• ${e.label}${e.url ? ` — ${e.url}` : ''}`, { indent: 10, size: 10 });
  }
  if (r.action_items?.length) {
    heading('Action Items');
    for (const a of r.action_items) draw(`[ ] ${a.text}${a.owner ? ` (${a.owner})` : ''}${a.due ? ` - due ${a.due}` : ''}`, { indent: 10, size: 10 });
  } else if (!isShort) {
    heading('Action Items');
    draw('(none recorded yet)', { color: [0.6, 0.6, 0.6], size: 10 });
  }

  const bytes = await doc.save();
  await query(`INSERT INTO meeting_report_event (report_id, event_type, detail) VALUES ($1, 'export_requested', $2::jsonb)`, [id, JSON.stringify({ format: 'pdf' })]);

  const filename = `${r.report_type}-${r.customer_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}
