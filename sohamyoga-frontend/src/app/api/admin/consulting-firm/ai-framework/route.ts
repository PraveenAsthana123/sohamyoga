import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { engagement_type, industry, description } = await req.json();

  const prompt = `Apply a consulting framework to: ${engagement_type} challenge at a ${industry} company in Alberta. Context: ${description}. Choose the most appropriate framework from: SWOT/PESTLE (situational), Porter's Five Forces (competitive), BCG Matrix (portfolio), McKinsey 7S (organizational), Balanced Scorecard (performance), VRIO (resource-based), Change Management ADKAR, or create a custom framework. Include: framework rationale, application to this specific situation, key questions to answer, data to gather, and expected insights.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ framework: data.response });
  } catch {
    return Response.json({
      framework: `FRAMEWORK APPLICATION — ${engagement_type?.toUpperCase()} | ${industry?.toUpperCase()}\n\nRECOMMENDED FRAMEWORK: McKinsey 7S Model\n\nRATIONALE: For a ${engagement_type?.replace(/_/g,' ')} engagement in ${industry}, the 7S framework ensures all organizational dimensions are aligned before and after change — especially critical when the challenge crosses functional boundaries.\n\nAPPLICATION:\nStrategy — Is the current strategy clearly articulated and understood at all levels?\nStructure — Does the organizational structure support the strategy?\nSystems — Are processes and information systems fit-for-purpose?\nShared Values — What cultural norms reinforce or resist the desired change?\nStyle — Does leadership behavior model the required transformation?\nStaff — Do people have the skills and capacity to deliver?\nSkills — Are core competencies aligned with strategic priorities?\n\nKEY QUESTIONS TO ANSWER:\n1. Where is alignment weakest across the 7 elements?\n2. Which elements are driving the current challenge?\n3. Which changes will create the greatest cascading benefit?\n\nDATA TO GATHER:\n• Org charts, RACI matrices, process maps\n• Employee engagement survey data\n• Strategic planning documents\n• Financial performance by business unit\n• Competitive benchmarks\n\nEXPECTED INSIGHTS:\n• Root causes of organizational misalignment\n• Priority intervention points\n• Change readiness score by department\n• Roadmap for realignment\n\n[Generated offline — Ollama unavailable]`,
      fallback: true,
    });
  }
}
