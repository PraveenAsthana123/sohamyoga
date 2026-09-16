export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const b = await req.json().catch(() => null);
  if (!b || !b.name || !b.channel) return Response.json({ error: 'name and channel required' }, { status: 400 });

  const channelInstructions: Record<string, string> = {
    email: 'Write a professional cold email with subject line. Max 150 words. Include a clear call-to-action.',
    linkedin: 'Write a LinkedIn connection request message. Max 300 characters. Be friendly and genuine.',
    sms: 'Write an SMS message. Max 160 characters. Be concise and personal.',
  };

  const prompt = `You are an expert B2B outreach copywriter. ${channelInstructions[b.channel] || channelInstructions.email}

Contact details:
- Name: ${b.name}
- Company: ${b.company || 'their company'}
- Role/Title: ${b.role || 'unknown'}
- Pain point: ${b.pain_point || 'scaling their operations'}
- Industry: ${b.industry || 'their industry'}

Return ONLY valid JSON:
{"subject": "<subject line or empty for non-email>", "body": "<the message body>", "channel": "${b.channel}"}`;

  let subject = '';
  let body = `Hi ${b.name}, I noticed ${b.company || 'your company'} is working on ${b.pain_point || 'growing your business'}. Our platform helps companies in ${b.industry || 'your space'} achieve results faster. Worth a quick chat?`;

  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const text = aiData.response || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { const parsed = JSON.parse(match[0]); subject = parsed.subject || ''; body = parsed.body || body; }
    }
  } catch { /* fallback to default body */ }

  return Response.json({ subject, body, channel: b.channel, contact: b.name });
}
