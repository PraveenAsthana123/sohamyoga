import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json();
  const prompt = `Write an OT home assessment report for: ${b.client_name || 'Client'}, age ${b.age || 'unknown'}, diagnoses: ${(b.diagnosis || []).join(', ') || 'not specified'}. Home setting: ${b.setting_type || 'single family home'}. Areas assessed: ${(b.areas || []).join(', ') || 'bathroom, bedroom, kitchen, entrance'}. Functional concerns noted. Include: barrier identification (room by room), fall risk factors, recommended modifications (prioritized by risk level), specific equipment recommendations (include approximate Canadian pricing), funding options (AISH, AHS Home Care, DVA, private), contractor referral notes, and re-assessment timeline. Alberta OT home assessment format.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ report: data.response });
  } catch {
    return Response.json({
      report: `OT HOME ASSESSMENT REPORT (AI unavailable — template)\n\nClient: ${b.client_name || '[Name]'} | Age: ${b.age || '[Age]'}\nDiagnosis: ${(b.diagnosis || []).join(', ') || '[Diagnosis]'}\nHome Setting: ${b.setting_type || '[Setting]'}\nAssessment Date: ${new Date().toLocaleDateString('en-CA')}\n\nAREAS ASSESSED: ${(b.areas || ['bathroom','bedroom','kitchen','entrance']).join(', ')}\n\nBARRIER IDENTIFICATION:\n\nBATHROOM:\n• No grab bars at toilet or shower — HIGH RISK\n• Tub entry requires step — MEDIUM RISK\n• Slippery floor surface — HIGH RISK\n\nBEDROOM:\n• Bed height assessment needed\n• Lighting adequate\n\nKITCHEN:\n• Counter height appropriate\n• Reaching high shelves — LOW RISK\n\nENTRANCE:\n• 2 steps with no railing — HIGH RISK for fall\n\nFALL RISK FACTORS:\n• History of falls, diagnosis-related balance issues\n• Environmental: multiple thresholds, insufficient lighting\n\nRECOMMENDED MODIFICATIONS (Priority Order):\n1. [IMMEDIATE] Install grab bars at toilet and shower — ~$150–300 CAD + installation\n2. [HIGH] Handrail at exterior steps — ~$200–400 CAD\n3. [HIGH] Non-slip mat in shower/tub — ~$30–50 CAD\n4. [MEDIUM] Shower chair/bench — ~$80–200 CAD\n5. [MEDIUM] Raised toilet seat — ~$50–100 CAD\n\nFUNDING OPTIONS:\n• AISH: Home modification funding available for eligible clients\n• AHS Home Care: Assessment and equipment program\n• DVA: Veterans Affairs Canada for eligible veterans\n• Private pay / extended health benefit plans\n\nCONTRACTOR REFERRAL:\nRefer to certified aging-in-place contractor for grab bar installation. Ensure proper wall anchoring per load requirements.\n\nRE-ASSESSMENT TIMELINE: 3 months following modification installation.\n\n_______________________\n[OT Name], OT Reg. (AB)\nAlberta College of Occupational Therapists\nDate: ${new Date().toLocaleDateString('en-CA')}`,
      fallback: true
    });
  }
}
