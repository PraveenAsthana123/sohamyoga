import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const totalDebt = (parseFloat(body.mortgage_balance||0)+parseFloat(body.heloc_balance||0)+
      parseFloat(body.car_loan_balance||0)+parseFloat(body.student_loan_balance||0)+
      parseFloat(body.credit_card_balance||0)+parseFloat(body.other_debt||0));
    const prompt = `Create a debt elimination strategy for: Total debt $${totalDebt.toFixed(0)}. Breakdown: Mortgage $${body.mortgage_balance||0} at ~5.5%, Credit cards $${body.credit_card_balance||0} at 19.99%, Car loan $${body.car_loan_balance||0} at ~7%, Student loans $${body.student_loan_balance||0} at prime+1%. Monthly disposable income: $${body.monthly_savings||0}. Choose avalanche vs snowball and explain. Include: payoff order, extra payment amounts, timeline to debt-free, interest savings, and psychological milestones. Canada-specific: mention HELOC options, government student loan forgiveness programs, credit counselling (Credit Counselling Society), and Alberta financial hardship resources.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ strategy: data.response, generated_by: 'ollama' });
    } catch {
      return NextResponse.json({
        strategy: `Debt Elimination Strategy:\n\n**Recommended Method: Avalanche (highest-interest first)**\n\nPayoff Order:\n1. Credit Cards ($${body.credit_card_balance||0}) at 19.99% — clear first\n2. Car Loan ($${body.car_loan_balance||0}) at ~7%\n3. Student Loans ($${body.student_loan_balance||0}) at prime+1%\n4. Mortgage ($${body.mortgage_balance||0}) — continue minimum payments\n\n**Canadian Resources**\n- Credit Counselling Society: nomoredebts.org\n- Student loan forgiveness: Canada Repayment Assistance Plan\n- Alberta financial hardship: albertabenefits.ca\n\n*AI service temporarily offline. Consult a licensed insolvency trustee for personalized advice.*`,
        generated_by: 'fallback',
        total_debt: totalDebt,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
