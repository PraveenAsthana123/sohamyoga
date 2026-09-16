import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { shoot_type, client_name, details } = await req.json();

  const prompt = `Write a photography proposal for a ${shoot_type} session for ${client_name}. ${details ? `Additional details: ${details}.` : ''} Include: session overview, what's included, investment options (3 tiers), preparation tips for the client, what to expect on the day, turnaround time, and a professional closing paragraph. Calgary, Alberta context.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json({ result: data.response, ai: true });
  } catch {
    const fallback = `PHOTOGRAPHY PROPOSAL
Client: ${client_name}
Session Type: ${shoot_type}
Location: Calgary, Alberta

SESSION OVERVIEW
━━━━━━━━━━━━━━━
We are thrilled to work with you on your ${shoot_type} photography session. Our goal is to create timeless, authentic images that tell your unique story.

WHAT'S INCLUDED
━━━━━━━━━━━━━━━
• Professional photography with top-of-the-line equipment
• Fully edited high-resolution digital images
• Online private gallery for easy viewing and downloading
• Print release for personal use
• Professional consultation before your session

INVESTMENT OPTIONS
━━━━━━━━━━━━━━━━━
Essential Package — From $450
• 1-hour session | 20 edited images | Online gallery

Signature Package — From $850
• 2-hour session | 50 edited images | Online gallery | 1 print included

Premium Collection — From $1,500
• Half-day session | 100+ edited images | Online gallery | Print credit | Engagement album

PREPARATION TIPS
━━━━━━━━━━━━━━━
• Plan your outfits 1-2 weeks in advance
• Avoid wearing logos or busy patterns
• Stay hydrated and well-rested the day before

TURNAROUND TIME
━━━━━━━━━━━━━━━
Your edited images will be delivered within 2-3 weeks via your private online gallery.

We look forward to creating beautiful memories with you!

⚠️ AI proposal generation unavailable — this is a standard template.`;
    return Response.json({ result: fallback, ai: false });
  }
}
