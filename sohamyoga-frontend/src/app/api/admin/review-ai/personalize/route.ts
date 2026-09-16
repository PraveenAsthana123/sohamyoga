export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { customer_name, rating, review_text, business_name } = await req.json();

  const sentiment = rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'negative';
  const prompt = `You are a customer response specialist for ${business_name || 'a yoga studio'}. Write a personalized, warm, professional response to this ${rating}-star review from ${customer_name}:

Review: "${review_text}"

Guidelines:
- Address them by first name
- Thank them specifically for their feedback
- For negative reviews: acknowledge their concern, apologize sincerely, offer concrete resolution
- For positive reviews: express genuine gratitude, reinforce specific things they praised
- End with an invitation to return or contact you
- Keep it under 150 words
- Do NOT use: "We value your feedback", "Dear valued customer", or any clichés

Return JSON:
{
  "response": "the personalized response",
  "tone": "${sentiment}",
  "key_acknowledgments": ["what you addressed"],
  "next_steps": "what should happen next"
}`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const firstName = (customer_name || 'there').split(' ')[0];
    const fallbackResponse = rating >= 4
      ? `Hi ${firstName}! Thank you so much for your wonderful review — it genuinely made our team's day! We're thrilled you had such a great experience. We look forward to seeing you again soon! 🙏`
      : `Hi ${firstName}, thank you for sharing this with us. I'm sorry your experience didn't meet your expectations — that's not the standard we hold ourselves to. I'd love to make this right personally. Please reach out to us at your convenience and we'll ensure your next visit exceeds expectations.`;

    return Response.json({
      response: (parsed.response as string) || fallbackResponse,
      tone: sentiment,
      key_acknowledgments: (parsed.key_acknowledgments as string[]) || ['Customer feedback acknowledged'],
      next_steps: (parsed.next_steps as string) || (rating < 3 ? 'Follow up with customer within 24 hours' : 'Invite to return for next session'),
      ai_generated: !!parsed.response,
    });
  } catch {
    return Response.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
