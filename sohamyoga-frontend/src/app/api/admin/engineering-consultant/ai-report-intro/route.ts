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
        options: { temperature: 0.3, num_predict: 800 },
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
  if (!body?.project_title || !body?.discipline) return Response.json({ error: 'project_title and discipline are required.' }, { status: 400 });

  if (circuitOpen()) {
    return Response.json({ intro: `[AI unavailable — circuit open]\n\nPlease draft the report introduction manually for: ${body.project_title}`, fallback: true });
  }

  const system = 'You are a senior Canadian Professional Engineer (P.Eng.) writing formal engineering report introductions. Write in a clear, technical, and professional style suitable for submission to Canadian municipal, provincial, or private clients.';
  const prompt = `Project Title: ${body.project_title}
Engineering Discipline: ${body.discipline}
Report Purpose: ${body.purpose ?? 'General engineering assessment and recommendations'}
${body.client ? `Client: ${body.client}` : ''}
${body.location ? `Project Location: ${body.location}` : ''}

Draft a professional Introduction section for this engineering report. Include:
1. Purpose and scope of the report
2. Project background and context
3. Authorization and study mandate (if applicable)
4. Report organization/structure overview
5. Professional engineer certification statement

Use formal technical writing appropriate for Canadian engineering practice. Keep to 3-5 paragraphs.`;

  try {
    const intro = await ollamaGenerate(prompt, system);
    return Response.json({ intro, fallback: false });
  } catch {
    return Response.json({ intro: '[AI generation failed — Ollama may be offline]\n\nPlease draft the introduction manually.', fallback: true });
  }
}
