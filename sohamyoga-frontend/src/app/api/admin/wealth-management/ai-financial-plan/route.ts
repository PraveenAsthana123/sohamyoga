import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const age = body.date_of_birth
      ? Math.floor((Date.now() - new Date(body.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : body.age || 35;
    const emergencyTarget = ((parseFloat(body.monthly_expenses || 0) || 3000) * 4.5).toFixed(0);
    const goals = Array.isArray(body.financial_goals) ? body.financial_goals.join(', ') : (body.financial_goals || 'retirement, home purchase');
    const prompt = `Create a comprehensive financial plan for a Canadian client: Age ${age}, Province: Alberta, Annual income: $${body.annual_income || 0}, Marital status: ${body.marital_status || 'single'}, Dependents: ${body.dependents || 0}, Employment: ${body.employment_status || 'employed'}. Net worth: $${body.net_worth || 0}. Goals: ${goals}. Current RRSP: $${body.rrsp_balance || 0}, TFSA: $${body.tfsa_balance || 0}. Include: budget breakdown (50/30/20 rule), RRSP vs TFSA contribution strategy for ${body.annual_income || 0} bracket, FHSA if applicable, emergency fund target (3-6 months = $${emergencyTarget}), debt payoff strategy, insurance coverage checklist, tax planning tips, and 5-year milestone targets. CRA 2024 contribution limits: RRSP 18% up to $31,560; TFSA $7,000; FHSA $8,000.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ plan: data.response, generated_by: 'ollama' });
    } catch {
      return NextResponse.json({
        plan: `Financial Plan for Canadian Client (Age ${age}):\n\n**Budget (50/30/20 Rule)**\n- Needs (50%): $${Math.round(parseFloat(body.annual_income||60000)/12*0.5).toLocaleString()}/mo\n- Wants (30%): $${Math.round(parseFloat(body.annual_income||60000)/12*0.3).toLocaleString()}/mo\n- Savings (20%): $${Math.round(parseFloat(body.annual_income||60000)/12*0.2).toLocaleString()}/mo\n\n**RRSP vs TFSA Strategy**\nFor income below $100k: prioritize TFSA ($7,000/yr). Above $100k: max RRSP first for deduction benefit (up to $31,560).\n\n**Emergency Fund Target**\n3-6 months of expenses = $${emergencyTarget}\n\n**5-Year Milestones**\n1. Year 1: Emergency fund fully funded\n2. Year 2: High-interest debt cleared\n3. Year 3: TFSA maximized annually\n4. Year 5: RRSP at 25% of retirement target\n\n*Note: AI service temporarily offline. This is a general framework — consult a licensed CFP for personalized advice.*`,
        generated_by: 'fallback',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
