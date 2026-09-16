import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    organization_name = 'Our Organization', program_name, amount,
    funder, mission, target_population,
  } = body;

  if (!program_name || !amount || !funder) {
    return NextResponse.json({ error: 'program_name, amount, and funder required' }, { status: 400 });
  }

  const prompt = `Write a grant proposal section for: ${organization_name}. Program/project: ${program_name}. Requested amount: $${amount}. Funding body: ${funder}. ${mission ? `Organization mission: ${mission}.` : ''} ${target_population ? `Target population: ${target_population}.` : ''} Include: organization overview (mission, history, CRA registration), project description with SMART objectives, target population served, budget justification, evaluation plan, expected outcomes and community impact, and sustainability plan. Calgary, Alberta non-profit sector. Professional grant writing tone.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return NextResponse.json({ proposal: data.response });
  } catch {
    return NextResponse.json({
      proposal: `GRANT PROPOSAL — ${program_name}\n\nOrganization: ${organization_name}\nRequested Amount: $${amount}\nFunding Body: ${funder}\n\n[AI service unavailable. Please retry or draft manually using the program details provided.]`,
      fallback: true,
    });
  }
}
