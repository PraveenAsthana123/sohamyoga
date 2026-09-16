import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { event_type = 'corporate', guest_count = 100, budget = 10000, theme = 'modern', client_name = 'Client' } = body;
    const prompt = `Create a detailed event proposal for ${client_name}: A ${event_type} event for ${guest_count} guests, budget $${budget} CAD, theme: ${theme}. Include: 1) Executive Summary, 2) Venue suggestions (Calgary/Alberta area — include specific venue types or neighborhoods), 3) Catering options with approximate per-head costs, 4) Entertainment recommendations, 5) Decor and theme execution, 6) Event day timeline (hour-by-hour), 7) Vendor checklist with vendor types and questions to ask, 8) Budget breakdown by category, 9) Key milestones/deadlines (working backward from event date), 10) Why us — our event planning value proposition. Format professionally with clear section headers. All amounts in CAD.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json({ proposal: data.response, source: 'ollama' });
      }
    } catch { /* fallback */ }
    const fallback = `EVENT PROPOSAL — ${event_type.toUpperCase()} EVENT\nClient: ${client_name} | Guests: ${guest_count} | Budget: $${budget.toLocaleString()} CAD | Theme: ${theme}\n\n1. Executive Summary\nWe are pleased to present this proposal for your ${event_type} event. Our team will handle all logistics so you can focus on the experience.\n\n2. Venue (Calgary/Alberta)\n• Hotel ballroom or conference centre (downtown Calgary)\n• Approximate cost: 20-30% of budget\n\n3. Catering\n• Plated dinner or buffet; est. $75-150 per head\n• Cocktail hour + 3-course dinner recommended\n\n4. Entertainment\n• Live band or DJ; photo booth; customized to theme\n\n5. Timeline (sample)\n• 5:00 PM — Guest arrival/cocktail hour\n• 6:00 PM — Welcome remarks\n• 7:00 PM — Dinner service\n• 8:30 PM — Entertainment/program\n• 10:30 PM — Event closes\n\n6. Budget Breakdown\n• Venue: 25% | Catering: 40% | Entertainment: 15% | Decor: 10% | Coordination: 10%\n\nNote: AI Proposal Generator (Ollama) offline — this is a template. Connect Ollama for a customized proposal.`;
    return Response.json({ proposal: fallback, source: 'fallback' });
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
