import { NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Voice of Customer digest export -- VoiceOfCustomerJob (weekly,
// Ollama-grounded only in real customer messages, skips if zero real
// messages exist that week) has produced real digests since earlier this
// session, but nothing had ever exported one as a document (found live
// 2026-09-01). Exports either one digest (?id=) or the N most recent
// (?limit=, default 8) as a real PDF.
interface DigestRow {
  period_start: string; period_end: string; source_message_count: number;
  themes: { label: string; count: number; sentiment: string }[];
  top_complaints: string[]; top_requests: string[]; overall_summary: string; status: string;
}

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 8, 50);

  const digests = id
    ? await query<DigestRow>(`SELECT period_start::text, period_end::text, source_message_count, themes, top_complaints, top_requests, overall_summary, status FROM voice_of_customer_digest WHERE id = $1`, [id])
    : await query<DigestRow>(`SELECT period_start::text, period_end::text, source_message_count, themes, top_complaints, top_requests, overall_summary, status FROM voice_of_customer_digest ORDER BY period_start DESC LIMIT $1`, [limit]);

  if (!digests.rowCount) {
    return Response.json({ error: 'No Voice of Customer digests exist yet -- VoiceOfCustomerJob has not produced one (it skips weeks with zero real customer messages).' }, { status: 404 });
  }

  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const ensureSpace = (needed: number) => { if (y - needed < 50) { page = doc.addPage([595, 842]); y = 800; } };
  const draw = (text: string, opts: { size?: number; f?: typeof font; indent?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 11;
    ensureSpace(size + 8);
    page.drawText(text, { x: 50 + (opts.indent ?? 0), y, size, font: opts.f ?? font, color: rgb(...(opts.color ?? [0.15, 0.15, 0.15])) });
    y -= size + 8;
  };
  const heading = (text: string) => { y -= 6; draw(text, { size: 15, f: bold, color: [0.1, 0.2, 0.4] }); y -= 2; };

  draw('Voice of Customer Report', { size: 22, f: bold });
  draw(`Generated ${new Date().toISOString().slice(0, 10)} · ${digests.rowCount} digest${digests.rowCount === 1 ? '' : 's'}`, { size: 9, color: [0.5, 0.5, 0.5] });
  draw('Every theme/complaint/request below is Ollama-grounded only in real customer messages from that week -- never fabricated.', { size: 8, color: [0.6, 0.6, 0.6] });

  for (const d of digests.rows) {
    heading(`Week of ${d.period_start} — ${d.period_end}`);
    draw(`${d.source_message_count} real customer message${d.source_message_count === 1 ? '' : 's'} · status: ${d.status}`, { size: 9, color: [0.5, 0.5, 0.5] });
    draw(d.overall_summary, { size: 10 });
    if (d.themes?.length) {
      draw('Themes:', { f: bold, size: 10 });
      for (const t of d.themes) draw(`- ${t.label} (${t.count}, ${t.sentiment})`, { indent: 10, size: 9 });
    }
    if (d.top_complaints?.length) {
      draw('Top complaints:', { f: bold, size: 10, color: [0.6, 0.2, 0.2] });
      for (const c of d.top_complaints) draw(`- ${c}`, { indent: 10, size: 9, color: [0.5, 0.3, 0.3] });
    }
    if (d.top_requests?.length) {
      draw('Top requests:', { f: bold, size: 10, color: [0.2, 0.4, 0.2] });
      for (const r of d.top_requests) draw(`- ${r}`, { indent: 10, size: 9, color: [0.3, 0.4, 0.3] });
    }
    y -= 8;
  }

  const bytes = await doc.save();
  const filename = id ? `voice-of-customer-${digests.rows[0].period_start}.pdf` : 'voice-of-customer-report.pdf';
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}
