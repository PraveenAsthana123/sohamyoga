import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Write a naturopathic SOAP note for a ${b.visit_type || 'follow_up'} visit. Presenting: ${b.subjective || ''}. Findings: ${b.objective || ''}. Assessment: ${b.assessment || ''}. Therapies used: ${(b.therapies_used || []).join(', ')}. Supplements prescribed: ${JSON.stringify(b.supplements_prescribed || [])}. Labs ordered: ${(b.labs_ordered || []).join(', ')}. Plan: ${b.plan || ''}. Include: proper ND documentation format, evidence rationale for each supplement/therapy, monitoring parameters, safety considerations, and follow-up timeline. Alberta naturopathic documentation standard.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ note: data.response });
  } catch {
    return Response.json({ note: `[AI unavailable] Naturopathic SOAP Note — ${new Date().toLocaleDateString('en-CA')}\n\nS: ${b.subjective || 'Patient presented for follow-up. '}\n\nO: ${b.objective || 'Physical exam findings documented.'}\n\nA: ${b.assessment || 'Working diagnosis per naturopathic assessment.'}\n\nP: Therapies: ${(b.therapies_used || []).join(', ') || 'none documented'}.\nSupplements: ${JSON.stringify(b.supplements_prescribed || [])}.\nLabs ordered: ${(b.labs_ordered || []).join(', ') || 'none'}.\n${b.plan || ''}\n\nFollow-up: As clinically indicated.\n\nPlease regenerate when AI is available for complete documentation.` });
  }
}
