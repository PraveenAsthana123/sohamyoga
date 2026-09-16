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
      body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], options: { temperature: 0.2, num_predict: 1000 } }),
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
  if (!body?.symptoms) return Response.json({ error: 'symptoms is required.' }, { status: 400 });

  if (circuitOpen()) {
    return Response.json({ steps: `[AI unavailable — circuit open]\n\nPlease troubleshoot manually:\n- Check event logs\n- Restart the service\n- Contact vendor support`, fallback: true });
  }

  const system = 'You are an experienced IT support technician and MSP specialist. Provide clear, step-by-step troubleshooting instructions for IT issues. Be specific, use numbered steps, and include verification commands or checks after each step. Focus on quick resolution and root cause identification.';
  const prompt = `IT Issue Troubleshooting Request:
Symptoms: ${body.symptoms}
Operating System: ${body.os ?? 'Windows'}
Category: ${body.category ?? 'general'}
${body.client_context ? `Client Context: ${body.client_context}` : ''}

Provide step-by-step troubleshooting instructions to diagnose and resolve this issue. Include:
1. Immediate quick checks (2-3 steps)
2. Detailed diagnostic steps (numbered)
3. Common root causes for this type of issue
4. Resolution steps for each likely cause
5. Escalation triggers (when to escalate to L2/L3 or vendor)

Be specific and include exact commands, menu paths, or UI steps where applicable.`;

  try {
    const steps = await ollamaGenerate(prompt, system);
    return Response.json({ steps, fallback: false });
  } catch {
    return Response.json({ steps: '[AI generation failed — Ollama may be offline]\n\nStandard troubleshooting:\n1. Restart the affected service\n2. Check Windows Event Viewer for errors\n3. Verify network connectivity\n4. Review recent changes\n5. Consult vendor documentation\n6. Escalate if unresolved in 30 minutes', fallback: true });
  }
}
