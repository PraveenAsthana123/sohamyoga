import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

async function ollamaGenerate(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { response: string };
  return data.response || '';
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { publisher_id, tone } = body as { publisher_id?: string; tone?: string };
    if (!publisher_id) return Response.json({ error: 'publisher_id is required' }, { status: 400 });
    const outreachTone = tone === 'friendly' ? 'friendly' : 'formal';

    const { rows } = await pool.query(`SELECT * FROM affiliate_publishers WHERE id=$1`, [publisher_id]);
    if (!rows.length) return Response.json({ error: 'Publisher not found' }, { status: 404 });
    const pub = rows[0];

    const nicheStr = Array.isArray(pub.niche) ? pub.niche.join(', ') : pub.niche || 'wellness';
    const audienceStr = pub.audience_size ? pub.audience_size.toLocaleString() : 'unknown';
    const commissionStr = pub.proposed_commission_pct ? `${pub.proposed_commission_pct}%` : '10-15%';

    const prompt = `Write a ${outreachTone} affiliate partnership outreach email to ${pub.contact_name}${pub.company_name ? ` at ${pub.company_name}` : ''}, a ${pub.publisher_type} in the ${nicheStr} niche with ${audienceStr} followers/audience. Our affiliate program at Soham Yoga offers ${commissionStr} commission on every successful referral. Include: a personalized hook relevant to their content style, program benefits (recurring commissions, dedicated support, exclusive content), commission structure, and a clear CTA to apply. Keep under 200 words. Be genuine and specific.

Respond in this exact JSON format:
{"subject": "...", "body": "..."}`;

    let subject = '';
    let body_text = '';

    try {
      const raw = await ollamaGenerate(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string };
        subject = parsed.subject || '';
        body_text = parsed.body || '';
      }
    } catch { /* fall through to fallback */ }

    if (!subject || !body_text) {
      // Fallback templates
      const isWarm = pub.status !== 'prospect';
      if (outreachTone === 'formal') {
        subject = `Partnership Opportunity — Soham Yoga Affiliate Program`;
        body_text = `Dear ${pub.contact_name},

I hope this message finds you well. My name is [Your Name] from Soham Yoga, and I am reaching out to explore a potential affiliate partnership.

Having followed ${pub.company_name || 'your work'} in the ${nicheStr} space, I believe there is strong alignment between your audience and our offerings.

Our affiliate program offers:
• ${commissionStr} commission on all referred sales
• 30-day cookie duration
• Dedicated partner support
• Exclusive promotional materials and early access

I would love to discuss how we can create a mutually beneficial partnership. Please find our program details at sohamyoga.com/affiliate.

Would you be open to a brief call this week?

Best regards,
[Your Name]
Soham Yoga Partnership Team`;
      } else {
        subject = `Hey ${pub.contact_name.split(' ')[0]}! Quick question about partnering 🧘`;
        body_text = `Hi ${pub.contact_name.split(' ')[0]}!

I've been following ${pub.company_name || 'your content'} for a while — your ${nicheStr} content is seriously great!

I'm reaching out from Soham Yoga because I think our affiliate program would be a natural fit for your audience. We offer ${commissionStr} commission, real-time tracking, and a team that actually cares about your success.

A quick 15-min chat could be worth it — interested?

Cheers,
[Your Name]
Soham Yoga`;
      }
    }

    // Store outreach note on publisher
    const outreachNote = `Outreach email generated [${new Date().toISOString()}]: Subject: "${subject}"`;
    await pool.query(`UPDATE affiliate_publishers SET notes = CONCAT(COALESCE(notes, ''), E'\n', $2), status = CASE WHEN status='prospect' THEN 'contacted' ELSE status END WHERE id=$1`, [publisher_id, outreachNote]);

    return Response.json({ subject, body: body_text });
  } catch (err) {
    console.error('affiliate-publishers outreach POST error:', err);
    return Response.json({ error: 'Failed to generate outreach email' }, { status: 500 });
  }
}
