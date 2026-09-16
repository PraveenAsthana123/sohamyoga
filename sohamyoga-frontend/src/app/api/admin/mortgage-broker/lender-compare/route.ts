import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { chat } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LENDER_RATE_GUIDE = {
  banks: { label: 'Big 6 Banks', typical_range: '5.09% – 5.79%', credit: 'A only', pros: 'Full service, branch network, bundled products', cons: 'Less flexible, posted rates higher' },
  monoline: { label: 'Monoline Lenders', typical_range: '4.89% – 5.49%', credit: 'A/A-', pros: 'Highly competitive rates, broker-only access', cons: 'No branch, refinance restrictions possible' },
  alt_b: { label: 'Alt-A/B Lenders', typical_range: '5.99% – 8.49%', credit: 'B/C', pros: 'Flexible underwriting, higher debt ratios', cons: 'Higher rates, lender fees' },
  private: { label: 'Private/MIC', typical_range: '10% – 15%+', credit: 'Any', pros: 'Asset-based, fast close, last resort', cons: 'Very high rates, short terms, fees' },
  cmhc: { label: 'CMHC Insured', typical_range: '4.79% – 5.29%', credit: 'A', pros: 'Lowest rates available, high LTV allowed', cons: 'Requires insurance premium, property cap $1.5M' },
};

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.mortgage_amount) return Response.json({ error: 'mortgage_amount required.' }, { status: 400 });

  const { mortgage_amount, amortization = 25, credit_tier = 'A', down_payment_pct = 20 } = b;

  const systemPrompt = `You are a Canadian mortgage broker expert. Provide concise, accurate rate comparison advice for Canadian mortgage clients.
Use current approximate market rates. Focus on actionable lender recommendations. Always mention CMHC if applicable.`;

  const userPrompt = `Compare lender options for:
- Mortgage amount: $${Number(mortgage_amount).toLocaleString()} CAD
- Amortization: ${amortization} years
- Credit tier: ${credit_tier}
- Down payment: ${down_payment_pct}%

Lender categories:
${JSON.stringify(LENDER_RATE_GUIDE, null, 2)}

Provide:
1. Top 3 recommended lender categories for this client profile and why
2. Estimated rate range they can expect
3. Any CMHC considerations (down < 20% + price < $1.5M)
4. Key conditions/requirements per lender type
5. One sentence broker tip for negotiating

Keep response under 400 words. Be specific to Canadian market.`;

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    const advice = await chat(messages, { timeout: AbortSignal.timeout(30000) });
    return Response.json({
      advice,
      lender_guide: LENDER_RATE_GUIDE,
      inputs: { mortgage_amount, amortization, credit_tier, down_payment_pct },
    });
  } catch {
    const fallback = `For a ${credit_tier}-credit borrower with $${Number(mortgage_amount).toLocaleString()} at ${amortization}yr amortization:

${credit_tier === 'A' ? `• **Monoline lenders** (First National, MCAP, Merix) typically offer the best rates (4.89%–5.49%) for A-credit borrowers
• **Big 6 Banks** are competitive for bundled clients (5.09%–5.79%)` : `• **Alt-B lenders** (Home Trust, Equitable Bank) are your primary options (5.99%–8.49%)
• Improve credit score to access A-lender rates`}
${Number(down_payment_pct) < 20 ? `• CMHC insurance is required — adds a premium (2.8%–4.0%) to your mortgage` : '• No CMHC required with 20%+ down payment'}

Tip: Always compare at least 3 lenders. Monolines are broker-only — they cannot be accessed by clients directly.`;
    return Response.json({
      advice: fallback,
      lender_guide: LENDER_RATE_GUIDE,
      inputs: { mortgage_amount, amortization, credit_tier, down_payment_pct },
      source: 'fallback',
    });
  }
}
