import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { OLLAMA_URL, OLLAMA_MODEL, circuitOpen } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEMO_SYSTEM: Record<string, string> = {
  management_letter: 'You are a Canadian CPA drafting a management letter. Write a professional, concise management letter identifying key internal control observations and recommendations consistent with CPA Canada standards.',
  tax_planning_memo: 'You are a Canadian CPA drafting a tax planning memorandum. Provide professional tax planning strategies and recommendations under the Income Tax Act and GST/HST legislation applicable in Canada.',
  engagement_letter: 'You are a Canadian CPA drafting an engagement letter. Write a clear, professional engagement letter outlining scope of services, responsibilities, fees, and terms consistent with CPA Canada professional standards.',
  compilation_report: 'You are a Canadian CPA drafting a compilation engagement report introduction. Write professionally in accordance with CSRS 4200 (Canadian Standard on Related Services).',
};

async function ollamaGenerate(prompt: string, system: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        options: { temperature: 0.3, num_predict: 1200 },
      }),
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { message?: { content?: string } };
    return data?.message?.content?.trim() ?? '';
  } catch {
    clearTimeout(t);
    throw new Error('Ollama unavailable');
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body?.memo_type || !body?.client_info) {
    return Response.json({ error: 'memo_type and client_info are required.' }, { status: 400 });
  }

  if (circuitOpen()) {
    return Response.json({
      memo: `[AI unavailable — circuit breaker open]\n\nMemo Type: ${body.memo_type}\nClient: ${body.client_info}\n\nPlease draft this document manually.\n\nDISCLAIMER: This communication is for professional CPA use only. Review by a licensed CPA is required before issuance.`,
      fallback: true,
    });
  }

  const system = MEMO_SYSTEM[body.memo_type] ?? MEMO_SYSTEM.management_letter;
  const prompt = `Client Information: ${body.client_info}\n${body.financial_data ? `Financial Data/Context: ${body.financial_data}\n` : ''}
Draft a professional ${(body.memo_type as string).replace(/_/g, ' ')} for this Canadian accounting engagement. Use appropriate professional language, reference Canadian standards (CPA Canada / IFRS / ASPE as applicable), and include relevant recommendations or scope language. Conclude with a standard CPA professional disclaimer noting this document requires review by a licensed CPA before issuance.`;

  try {
    const memo = await ollamaGenerate(prompt, system);
    return Response.json({ memo, fallback: false });
  } catch {
    return Response.json({
      memo: `[AI generation failed — Ollama may be offline]\n\nPlease draft this ${(body.memo_type as string).replace(/_/g, ' ')} manually.\n\nDISCLAIMER: This communication is for professional CPA use only. Review by a licensed CPA is required before issuance.`,
      fallback: true,
    });
  }
}
