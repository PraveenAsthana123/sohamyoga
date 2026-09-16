import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Draft a mental health treatment plan framework for: Presenting concerns: ${(b.presenting_concerns || []).join(', ')}, using ${(b.modality || []).join(', ')} approach. Include: problem formulation, SMART treatment goals (3-5), proposed interventions, session frequency rationale, measurable outcomes, risk and protective factors, and review timeline. Important disclaimer: This draft requires therapist review, modification, and clinical judgment before use. Not for use without therapist oversight.`;
  const disclaimer = `\n\n---\nCRITICAL DISCLAIMER: This AI-generated draft requires thorough therapist review and clinical judgment before use. It does not constitute a clinical diagnosis, treatment recommendation, or professional opinion. The treating therapist must independently assess all goals, interventions, risk factors, and protective factors based on direct clinical knowledge of the client. Not for use without therapist oversight.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ plan: data.response + disclaimer });
  } catch {
    return Response.json({ plan: `[AI unavailable] Treatment Plan Framework Draft\n\nPresenting Concerns: ${(b.presenting_concerns || []).join(', ')}\nModality: ${(b.modality || []).join(', ')}\n\nProblem Formulation: [Therapist to complete based on clinical assessment]\n\nSMART Treatment Goals:\n1. [Goal 1 — specific, measurable, achievable, relevant, time-bound]\n2. [Goal 2]\n3. [Goal 3]\n\nProposed Interventions: Evidence-based techniques per selected modality.\n\nSession Frequency: Weekly initially, titrate based on progress.\n\nReview Date: 6-8 sessions or 6 weeks, whichever comes first.\n\nRisk Factors: [Therapist to complete]\nProtective Factors: [Therapist to complete]${disclaimer}` });
  }
}
