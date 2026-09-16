import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json();
  const { treatment_type = 'follow_up', primary_diagnosis = '', subjective = '', objective_findings = '', techniques = '', goals = '' } = b;

  const prompt = `Write a professional physiotherapy SOAP note for: ${treatment_type.replace(/_/g,' ')} session. Patient diagnosis: ${primary_diagnosis}. Subjective: ${subjective}. Objective findings: ${objective_findings}. Treatment provided: ${techniques}. Include formatted Subjective, Objective (with specific measurements), Assessment (progress toward ${goals || 'treatment goals'}), and Plan (next session goals, home program). Alberta physiotherapy documentation standard. Use clinical terminology.`;

  const fallback = `S: ${subjective || 'Patient reports ongoing symptoms consistent with diagnosis.'}\n\nO: ${objective_findings || 'Objective assessment performed. Range of motion and strength tested.'} Treatment: ${techniques || 'Physiotherapy interventions applied per plan.'}.\n\nA: Patient demonstrating ${goals ? `progress toward: ${goals}` : 'gradual improvement with treatment'}. Functional gains noted.\n\nP: Continue current treatment plan. Patient instructed on home exercise program. Follow-up scheduled.`;

  let soapNote = fallback;
  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      if (data.response) soapNote = data.response.trim();
    }
  } catch { /* use fallback */ }

  return Response.json({ soap_note: soapNote, generated_at: new Date().toISOString() });
}
