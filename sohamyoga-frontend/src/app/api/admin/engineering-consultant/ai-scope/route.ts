import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { OLLAMA_URL, OLLAMA_MODEL, circuitOpen } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ollamaGenerate(prompt: string, system: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL, stream: false,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        options: { temperature: 0.3, num_predict: 1500 },
      }),
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
  if (!body?.discipline || !body?.scope_description) return Response.json({ error: 'discipline and scope_description are required.' }, { status: 400 });

  if (circuitOpen()) {
    return Response.json({ scope: `[AI unavailable — circuit open]\n\nPlease draft the scope of work manually for: ${body.discipline} — ${body.scope_description}`, fallback: true });
  }

  const system = 'You are a senior Canadian Professional Engineer (P.Eng.) drafting scope of work documents and deliverables lists for engineering consulting proposals. Use professional technical language appropriate for Canadian engineering practice. Reference applicable Canadian standards (CSA, NBC, provincial codes) where relevant.';
  const prompt = `Engineering Discipline: ${body.discipline}
Project Type: ${body.project_type ?? 'General'}
Scope Description: ${body.scope_description}

Draft a professional Scope of Work (SOW) for this Canadian engineering consulting engagement. Include:
1. Project Background & Objectives
2. Scope of Services (detailed breakdown by phase)
3. Typical Deliverables List (with document types: reports, drawings, calculations, specifications, assessments)
4. Exclusions from Scope
5. Applicable Standards and References (Canadian codes)
6. Assumptions and Constraints

Format clearly with numbered sections and bullet points.`;

  try {
    const scope = await ollamaGenerate(prompt, system);
    return Response.json({ scope, fallback: false });
  } catch {
    return Response.json({ scope: '[AI generation failed — Ollama may be offline]\n\nPlease draft the scope of work manually.', fallback: true });
  }
}
