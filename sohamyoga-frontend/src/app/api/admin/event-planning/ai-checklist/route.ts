import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { event_type = 'corporate', weeks_out = 12, guest_count = 100 } = body;
    const prompt = `Generate a comprehensive event planning checklist for a ${event_type} event with ${guest_count} guests, starting ${weeks_out} weeks before the event date. Organize by timeframe with clear headers: 12 weeks out (or ${weeks_out} weeks out if different), 8 weeks out, 6 weeks out, 4 weeks out, 2 weeks out, 1 week out, 3 days before, day before, day of event, post-event. For each timeframe, include: vendor management tasks, booking deadlines, design/print deadlines, guest experience items, logistics, staff/volunteer coordination, contingency planning, budget reconciliation, and communication tasks. Format as a checklist with checkboxes ([ ]). Tailor for a Canadian context (Alberta/Calgary). Be specific and actionable.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json({ checklist: data.response, source: 'ollama' });
      }
    } catch { /* fallback */ }
    const fallback = `EVENT PLANNING CHECKLIST — ${event_type.toUpperCase()} | ${weeks_out} Weeks Out\n\n12 WEEKS OUT\n[ ] Define event vision, goals, and budget\n[ ] Book venue — confirm availability and capacity\n[ ] Hire event coordinator / assign internal lead\n[ ] Begin vendor outreach (catering, AV, photography)\n\n8 WEEKS OUT\n[ ] Confirm catering and menu selections\n[ ] Send save-the-dates / invitations\n[ ] Finalize decor concept\n[ ] Confirm entertainment / speakers\n\n4 WEEKS OUT\n[ ] Collect RSVP counts\n[ ] Confirm all vendor contracts signed\n[ ] Submit floor plan and seating to venue\n[ ] Order printed materials\n\n2 WEEKS OUT\n[ ] Final guest count to caterer\n[ ] Confirm AV setup and test\n[ ] Brief all staff/volunteers\n\n1 WEEK OUT\n[ ] Prepare day-of timeline\n[ ] Confirm deliveries and setup schedule\n\nDAY OF\n[ ] Vendor check-ins and setup supervision\n[ ] Guest registration and welcome\n[ ] Monitor program timing\n\nPOST-EVENT\n[ ] Vendor payments and thank-yous\n[ ] Collect feedback\n[ ] Debrief team\n\nNote: AI Checklist Generator (Ollama) offline — connect for a custom checklist.`;
    return Response.json({ checklist: fallback, source: 'fallback' });
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
