import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json();
  const { primary_diagnosis = '', date_of_injury = '', referral_source = 'physician', treatment_goals = '', duration_weeks = 6 } = b;

  const prompt = `Create a physiotherapy treatment plan for: ${primary_diagnosis}, ${date_of_injury || 'recent'} injury, ${referral_source} referral. Goals: ${treatment_goals}. Include: diagnosis summary, short/long-term goals (SMART format), proposed treatment frequency (typical: 2-3x/week × ${duration_weeks} weeks), evidence-based techniques, home exercise program rationale, WCB/insurance documentation notes, and discharge criteria. Alberta physiotherapy practice standards.`;

  const fallback = `PHYSIOTHERAPY TREATMENT PLAN\n\nDiagnosis: ${primary_diagnosis}\nDate of Injury: ${date_of_injury || 'Recent'}\nReferral Source: ${referral_source}\n\nSHORT-TERM GOALS (2-3 weeks):\n• Reduce pain by 2+ points on VAS scale\n• Improve ROM by 20%\n• Independent with basic ADLs\n\nLONG-TERM GOALS (${duration_weeks} weeks):\n• Return to full functional activity\n• ${treatment_goals || 'Full recovery and return to pre-injury level'}\n\nTREATMENT FREQUENCY: 2-3x/week × ${duration_weeks} weeks\n\nTECHNIQUES:\n• Manual therapy (joint mobilization/manipulation)\n• Therapeutic exercise progression\n• Modalities as indicated (ultrasound, IFC, TENS)\n• Taping/bracing as required\n\nHOME EXERCISE PROGRAM:\n• Daily stretching and strengthening exercises\n• Progressive loading program\n• Activity modification education\n\nDISCHARGE CRITERIA:\n• Goals achieved\n• Independent with HEP\n• Return to full function`;

  let plan = fallback;
  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      if (data.response) plan = data.response.trim();
    }
  } catch { /* use fallback */ }

  return Response.json({ treatment_plan: plan, generated_at: new Date().toISOString() });
}
