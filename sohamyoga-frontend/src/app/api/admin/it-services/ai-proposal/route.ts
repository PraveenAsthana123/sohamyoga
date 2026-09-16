import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { OLLAMA_URL, OLLAMA_MODEL, circuitOpen } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ollamaGenerate(prompt: string, system: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], options: { temperature: 0.3, num_predict: 1500 } }),
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { message?: { content?: string } };
    return data?.message?.content?.trim() ?? '';
  } catch { clearTimeout(t); throw new Error('Ollama unavailable'); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body?.services_needed) return Response.json({ error: 'services_needed is required.' }, { status: 400 });

  if (circuitOpen()) {
    return Response.json({ proposal: '[AI unavailable — circuit open]\n\nPlease draft the MSP proposal manually.', fallback: true });
  }

  const system = 'You are an experienced Managed Service Provider (MSP) sales engineer and solution architect in Canada. Draft professional, compelling MSP proposals that clearly articulate value, address pain points, and present a structured service offering with transparent pricing frameworks.';
  const prompt = `MSP Proposal Request:
Client Size: ${body.client_size ?? 'SMB (10-50 users)'}
Industry: ${body.industry ?? 'Not specified'}
Services Needed: ${body.services_needed}
Pain Points: ${body.pain_points ?? 'Not specified'}
${body.current_it ? `Current IT Environment: ${body.current_it}` : ''}

Draft a professional MSP (Managed Service Provider) proposal for this Canadian business. Include:
1. Executive Summary (addressing their specific pain points)
2. Proposed Services Overview (detailed service tiers)
3. Technical Solution Architecture
4. Service Level Agreement Overview (response/resolution targets)
5. Onboarding Process (4-week plan)
6. Investment Summary (pricing framework — use "starting from" language)
7. Why Choose Us (MSP value proposition)
8. Next Steps

Format as a professional proposal document with clear sections.`;

  try {
    const proposal = await ollamaGenerate(prompt, system);
    return Response.json({ proposal, fallback: false });
  } catch {
    return Response.json({ proposal: '[AI generation failed — Ollama may be offline]\n\nPlease draft the MSP proposal manually.', fallback: true });
  }
}
