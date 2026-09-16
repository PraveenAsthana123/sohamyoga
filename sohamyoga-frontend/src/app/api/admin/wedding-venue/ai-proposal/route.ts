import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { couple_name1, couple_name2, event_date, guest_count, venue_type, event_type } = body;

  const prompt = `Write a luxury wedding venue proposal for: ${couple_name1} & ${couple_name2||'partner'}, ${event_date}, ${guest_count} guests, ${venue_type} venue. Event type: ${event_type||'wedding'}. Include: venue description, what's included in the package, ceremony options, reception setup, catering options, vendor partnerships, day-of coordination, pricing overview, and a heartfelt closing paragraph. Professional, elegant tone. Alberta, Canada.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json() as { response: string };
    return Response.json({ proposal: data.response });
  } catch {
    return Response.json({
      proposal: `WEDDING VENUE PROPOSAL\n\nPrepared for: ${couple_name1} & ${couple_name2||'Partner'}\nEvent Date: ${event_date}\nExpected Guests: ${guest_count}\nVenue Type: ${venue_type}\n\nDear ${couple_name1} & ${couple_name2||'Partner'},\n\nThank you for considering our venue for your special day. We are delighted to present this exclusive proposal for your celebration in Alberta.\n\nOUR VENUE\nOur stunning ${venue_type} venue sets the perfect stage for your wedding ceremony and reception. With breathtaking surroundings and world-class amenities, every detail has been thoughtfully designed to make your day unforgettable.\n\nWHAT'S INCLUDED\n- Exclusive venue access for your event date\n- Professional setup and teardown\n- Tables, chairs, and linens\n- Bridal suite access\n- Day-of coordination\n- Parking for up to ${Math.ceil(Number(guest_count)/2)} vehicles\n\nCATERING & VENDORS\nWe partner with Alberta's finest caterers, photographers, florists, and DJs. Our preferred vendor network ensures seamless service and competitive pricing.\n\nWe look forward to making your dream wedding a reality.\n\nNote: AI service unavailable — fallback template used.`,
    });
  }
}
