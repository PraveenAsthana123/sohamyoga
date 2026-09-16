export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { complaint_text } = await req.json();

  const prompt = `You are a customer service AI for a yoga/wellness business. Classify this complaint:
"${complaint_text}"

Return JSON:
{
  "category": "Product|Service|Delivery|Staff|Billing|Technology|Facility",
  "subcategory": "more specific subcategory",
  "priority": "low|medium|high|urgent",
  "sentiment_score": -0.8,
  "escalation_required": false,
  "suggested_response": "personalized, empathetic response template",
  "resolution_steps": ["step 1", "step 2", "step 3"],
  "root_cause": "likely root cause"
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
    return Response.json({
      category: parsed.category || 'Service',
      subcategory: parsed.subcategory || 'General',
      priority: parsed.priority || 'medium',
      sentiment_score: parsed.sentiment_score || -0.5,
      escalation_required: parsed.escalation_required || false,
      suggested_response: parsed.suggested_response || 'Thank you for reaching out. We take your feedback seriously and want to make this right. A member of our team will contact you within 24 hours.',
      resolution_steps: (parsed.resolution_steps as string[]) || ['Acknowledge the issue', 'Investigate root cause', 'Provide resolution + follow-up'],
      root_cause: parsed.root_cause || 'Requires investigation',
      ai_generated: !!parsed.category,
    });
  } catch {
    return Response.json({ error: 'AI analysis unavailable' }, { status: 503 });
  }
}
