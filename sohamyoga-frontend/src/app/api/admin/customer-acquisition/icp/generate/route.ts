import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ollama } from '@/cron/OllamaClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { business_type, product_service, current_customers_desc } = body as Record<string, string>;
    if (!business_type || !product_service) {
      return Response.json({ error: 'business_type and product_service are required.' }, { status: 400 });
    }

    const prompt = `Generate a detailed Ideal Customer Profile (ICP) for a ${business_type} selling ${product_service}.
Current customers description: ${current_customers_desc ?? 'Not provided'}.

Include:
- industry: string
- company_size: one of startup | smb | mid_market | enterprise
- revenue_range: string (e.g. "$1M–$10M")
- geography: string (most likely regions)
- job_titles: array of 3 decision maker titles
- pain_points: array of 5 specific pain points
- goals: array of 4 measurable goals
- buying_triggers: array of 3 events that trigger purchase
- objections: array of 3 common objections
- preferred_channels: array of 4 channels where they can be reached
- budget_range: string (annual spend range)
- sales_cycle: string (estimated sales cycle)
- ai_summary: 2-sentence summary of this ICP for a sales rep

Output ONLY a valid JSON object. No explanation, no markdown fences.`;

    const raw = await ollama.generate(prompt, {
      tier: 'strong',
      maxTokens: 1200,
      timeoutMs: 60_000,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Ollama did not return a parseable JSON object.' }, { status: 502 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    return Response.json({ ok: true, icp: parsed });
  } catch (err) {
    console.error('[icp/generate] POST error:', err);
    const message = err instanceof Error ? err.message : 'AI generation failed.';
    return Response.json({ error: message }, { status: 502 });
  }
}
