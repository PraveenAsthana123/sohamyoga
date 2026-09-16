import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:latest';

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

  const prompt = `You are a Canadian mortgage broker expert. Compare lender options for this client:

Mortgage amount: $${Number(mortgage_amount).toLocaleString()} CAD
Amortization: ${amortization} years
Credit tier: ${credit_tier}
Down payment: ${down_payment_pct}%

Lender categories:
${JSON.stringify(LENDER_RATE_GUIDE, null, 2)}

Provide:
1. Top 3 recommended lender categories for this profile and why
2. Estimated rate range they can expect
3. CMHC considerations if down payment under 20% and price under $1.5M
4. Key conditions/requirements per lender type
5. One broker tip for negotiating

Keep response under 400 words. Be specific to the Canadian market.`;

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
    const data = await resp.json() as { response?: string };
    return Response.json({
      advice: data.response ?? '',
      lender_guide: LENDER_RATE_GUIDE,
      inputs: { mortgage_amount, amortization, credit_tier, down_payment_pct },
    });
  } catch {
    const cmhcNote = Number(down_payment_pct) < 20
      ? '• CMHC insurance required — adds a 2.8%–4.0% premium to your mortgage balance'
      : '• No CMHC required (20%+ down payment)';

    const creditNote = credit_tier === 'A'
      ? '• Monoline lenders (First National, MCAP, Merix) typically offer best rates (4.89%–5.49%)\n• Big 6 Banks competitive for bundled clients (5.09%–5.79%)'
      : credit_tier === 'B'
      ? '• Alt-B lenders (Home Trust, Equitable Bank, Haventree Bank) are primary options (5.99%–8.49%)\n• Improving credit score opens access to A-lender rates'
      : '• Private lenders / MIC networks for C-tier — expect 10%–15%+ rates\n• Bridge to Alt-B as credit improves';

    const fallback = `**Lender Comparison (Offline Mode)**

For $${Number(mortgage_amount).toLocaleString()} at ${amortization}yr amortization, ${credit_tier}-credit:

${creditNote}
${cmhcNote}

Broker tip: Always compare at least 3 lenders. Monolines are broker-only — clients cannot access them directly. Rate holds are typically 90–120 days.`;

    return Response.json({
      advice: fallback,
      lender_guide: LENDER_RATE_GUIDE,
      inputs: { mortgage_amount, amortization, credit_tier, down_payment_pct },
      source: 'fallback',
    });
  }
}
