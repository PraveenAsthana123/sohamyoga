import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const TIER_BENEFITS: Record<string, string> = {
  title: 'exclusive naming rights on all event materials, a premium speaking slot, VIP table for 10, logo placement on stage and all digital/print, and 5 social media mentions',
  platinum: 'logo on all printed and digital materials, a VIP table for 6, 3 social media mentions, and brand placement in the event program',
  gold: 'logo on all event materials, 2 event tickets, 1 social media mention, and listing in the event program',
  silver: 'logo on our website and event program, 1 event ticket, and name mention at the event',
  bronze: 'name listing on our sponsor page and event program with our sincere appreciation',
  in_kind: 'name listing on our sponsor page, recognition at the event, and a warm thank-you from the entire Soham Yoga community',
};

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.company_name || !body.event_name || !body.tier) {
    return Response.json({ error: 'company_name, event_name, and tier are required' }, { status: 400 });
  }
  const { company_name, event_name, tier, amount_cad } = body as { company_name: string; event_name: string; tier: string; amount_cad?: number };
  const benefits = TIER_BENEFITS[tier] || TIER_BENEFITS.bronze;
  const amountStr = amount_cad ? `$${Number(amount_cad).toLocaleString('en-CA')} CAD` : 'a competitive investment';

  const prompt = `Write a sponsorship pitch email to ${company_name} for our ${tier.toUpperCase()} tier sponsorship of ${event_name} at ${amountStr}. Include: event overview (wellness community event in Toronto, 500+ attendees, health-conscious demographic aged 25-45), audience profile, sponsor benefits for this tier (${benefits}), ROI for sponsor (brand visibility, lead generation, community goodwill), clear CTA to respond or schedule a call. Professional tone, 200 words max. Start with Subject: on the first line, then a blank line, then the email body.`;

  let subject = `Partnership Opportunity: ${tier.charAt(0).toUpperCase() + tier.slice(1)} Sponsorship of ${event_name}`;
  let emailBody = '';

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const data = await res.json() as { response?: string };
      const raw = data.response?.trim() || '';
      const lines = raw.split('\n');
      if (lines[0].toLowerCase().startsWith('subject:')) {
        subject = lines[0].replace(/^subject:\s*/i, '').trim();
        emailBody = lines.slice(2).join('\n').trim();
      } else {
        emailBody = raw;
      }
    }
  } catch { /* intentional */ }

  if (!emailBody) {
    emailBody = `Dear ${company_name} Team,

We are excited to invite ${company_name} to be a ${tier.toUpperCase()} sponsor of ${event_name}!

${event_name} brings together 500+ health-conscious Torontonians aged 25-45 for a day of yoga, wellness, and community. Your investment of ${amountStr} secures ${benefits}.

This is a powerful opportunity to position ${company_name} as a wellness leader, generate qualified leads, and earn genuine community goodwill with an engaged, affluent audience.

We would love to connect and discuss how this partnership can deliver real ROI for ${company_name}. Please reply to this email or book a 20-minute call at your convenience.

Warm regards,
The Soham Yoga Team`;
  }

  return Response.json({ subject, body: emailBody });
}
