import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json();
  const prompt = `Write a chiropractic SOAP note for: ${b.visit_type || 'treatment'}, ${b.primary_complaint || 'low back pain'}, pain level ${b.pain_level_today ?? '?'}/10. Subjective: ${b.subjective || 'not provided'}. Adjustments performed: ${(b.adjustments_performed || []).join(', ') || 'not specified'}. Modalities: ${(b.modalities_used || []).join(', ') || 'none'}. Progress since last visit: ${b.progress || 'unknown'}. Include formatted SOAP with chiropractic-specific terminology, objective findings (ROM, palpation, ortho tests), assessment paragraph, and treatment plan. Alberta chiropractic documentation standard.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ soap: data.response });
  } catch {
    return Response.json({ soap: `SOAP Note (AI unavailable)\n\nS: Patient reports ${b.primary_complaint || 'chief complaint not specified'}. Pain level ${b.pain_level_today ?? 'N/A'}/10. ${b.subjective || ''}\n\nO: Postural analysis performed. Range of motion assessed. Orthopedic and neurological tests conducted. Palpation reveals areas of tenderness and restriction consistent with presenting complaint.\n\nA: ${b.primary_complaint || 'Musculoskeletal dysfunction'}. Patient demonstrates ${b.progress === 'improved' ? 'positive response' : b.progress === 'worse' ? 'worsening symptoms' : 'stable condition'} to chiropractic care.\n\nP: Continue current treatment plan. ${(b.adjustments_performed || []).length ? 'Adjustments: ' + b.adjustments_performed.join(', ') + '. ' : ''}${(b.modalities_used || []).length ? 'Modalities: ' + b.modalities_used.join(', ') + '. ' : ''}Home exercise program reviewed. Follow-up as per treatment plan.`, fallback: true });
  }
}
