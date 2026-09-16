import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { guest_count, ceremony_time, reception_time, venue_type } = body;

  const prompt = `Create a detailed wedding day timeline for a ${guest_count}-person wedding with ceremony at ${ceremony_time} and reception at ${reception_time} at a ${venue_type} venue. Include: vendor arrival times, bridal party schedule, ceremony sequence, cocktail hour, reception dinner service, speeches, first dance, cake cutting, and venue cleanup. 15-minute increments.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json() as { response: string };
    return Response.json({ timeline: data.response });
  } catch {
    const ceremonyH = ceremony_time ? parseInt(ceremony_time.split(':')[0]) : 14;
    return Response.json({
      timeline: `WEDDING DAY TIMELINE\nGuests: ${guest_count} | Ceremony: ${ceremony_time} | Reception: ${reception_time} | Venue: ${venue_type}\n\n${String(ceremonyH-4).padStart(2,'0')}:00 — Venue opens, setup crew arrives\n${String(ceremonyH-3).padStart(2,'0')}:00 — Catering team arrives, kitchen setup\n${String(ceremonyH-2).padStart(2,'0')}:00 — Florals & decor installed\n${String(ceremonyH-2).padStart(2,'0')}:30 — Photographer & videographer arrive, detail shots\n${String(ceremonyH-1).padStart(2,'0')}:00 — Bridal party hair & makeup final touches\n${String(ceremonyH-1).padStart(2,'0')}:30 — First look photos (optional)\n${String(ceremonyH).padStart(2,'0')}:00 — Guests begin arriving, ushers in position\n${String(ceremonyH).padStart(2,'0')}:25 — Wedding party processional\n${String(ceremonyH).padStart(2,'0')}:30 — Ceremony begins\n${String(ceremonyH+1).padStart(2,'0')}:00 — Ceremony concludes, recessional\n${String(ceremonyH+1).padStart(2,'0')}:15 — Cocktail hour begins, group photos\n${String(ceremonyH+2).padStart(2,'0')}:30 — Grand entrance to reception\n${String(ceremonyH+2).padStart(2,'0')}:45 — First dance\n${String(ceremonyH+3).padStart(2,'0')}:00 — Dinner service begins\n${String(ceremonyH+3).padStart(2,'0')}:30 — Toasts & speeches\n${String(ceremonyH+4).padStart(2,'0')}:00 — Cake cutting\n${String(ceremonyH+4).padStart(2,'0')}:30 — Dancing & open bar\n${String(ceremonyH+6).padStart(2,'0')}:00 — Last dance & send-off\n${String(ceremonyH+6).padStart(2,'0')}:30 — Venue cleanup begins\n\nNote: AI service unavailable — fallback template used.`,
    });
  }
}
