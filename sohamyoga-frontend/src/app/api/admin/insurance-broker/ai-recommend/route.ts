import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const {
    age = 35,
    income = 60000,
    smoker = false,
    has_dependents = false,
    owns_home = false,
    has_vehicle = false,
    occupation = 'professional',
    current_coverage = [],
  } = b;

  const prompt = `You are a licensed Canadian insurance broker advisor. Analyze this client profile and provide personalized coverage recommendations for the Canadian insurance market (Alberta/Canada).

CLIENT PROFILE:
- Age: ${age}
- Annual Income: $${income.toLocaleString()} CAD
- Smoker: ${smoker ? 'Yes' : 'No'}
- Has Dependents: ${has_dependents ? 'Yes' : 'No'}
- Owns Home: ${owns_home ? 'Yes' : 'No'}
- Has Vehicle: ${has_vehicle ? 'Yes' : 'No'}
- Occupation: ${occupation}
- Current Coverage: ${current_coverage.length ? current_coverage.join(', ') : 'None'}

CANADIAN INSURERS TO REFERENCE:
- Health: Manulife, Sun Life, Canada Life, AB Blue Cross, Green Shield Canada
- Life: Sun Life, Manulife, Canada Life, iA Financial, Empire Life
- Home: Intact, Aviva Canada, Wawanesa, TD Insurance
- Vehicle: Intact, Aviva, TD Insurance, Wawanesa, CAA Insurance
- Disability: Manulife, Sun Life, Canada Life, RBC Insurance
- Critical Illness: Sun Life, Manulife, Canada Life, RBC Insurance
- Travel: Manulife Travel, Blue Cross Travel, TuGo, Allianz Global

Provide a structured analysis covering:
1. COVERAGE GAPS (what this client is missing and why it matters)
2. PRIORITY RECOMMENDATIONS (ranked 1-5, most urgent first)
3. RECOMMENDED COVERAGE AMOUNTS (with Canadian market context)
4. ESTIMATED PREMIUM RANGES (monthly CAD, realistic Canadian market rates)
5. TOP 3 INSURERS TO QUOTE (for each recommended product)
6. SPECIAL CONSIDERATIONS (for their age, income, occupation, or family situation)

Be specific, practical, and reference actual Canadian products and typical Alberta premium ranges.`;

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
    const data = await resp.json() as { response?: string };
    return Response.json({ recommendation: data.response ?? '' });
  } catch {
    // Graceful fallback
    const gaps: string[] = [];
    const recs: string[] = [];

    if (!current_coverage.includes('life') && has_dependents) {
      gaps.push('Life insurance — you have dependents but no life coverage');
      recs.push(`Life Insurance: $${Math.round(income * 10).toLocaleString()} CAD coverage recommended (10× income rule). Quote: Sun Life, Manulife, Canada Life. Est. $${smoker ? '80–200' : '25–80'}/mo.`);
    }
    if (!current_coverage.includes('disability')) {
      gaps.push('Disability insurance — income replacement if you cannot work');
      recs.push(`Disability Insurance: 70–85% of income ($${Math.round(income * 0.7 / 12).toLocaleString()}/mo). Quote: Manulife, Sun Life, RBC Insurance. Est. $60–150/mo.`);
    }
    if (!current_coverage.includes('health')) {
      gaps.push('Extended health — dental, vision, prescription drugs not covered by AB Health');
      recs.push('Extended Health: Quote AB Blue Cross, Green Shield Canada, Manulife. Est. $80–180/mo individual.');
    }
    if (!current_coverage.includes('critical_illness') && age > 35) {
      gaps.push('Critical illness — lump-sum payout on cancer, heart attack, stroke diagnosis');
      recs.push(`Critical Illness: $100,000 coverage recommended. Quote: Sun Life, Manulife, Canada Life. Est. $${smoker ? '80–200' : '40–100'}/mo.`);
    }
    if (owns_home && !current_coverage.includes('home')) {
      gaps.push('Home/property insurance — protecting your largest asset');
      recs.push('Home Insurance: $300,000+ coverage (replacement value). Quote: Intact, Wawanesa, Aviva Canada. Est. $80–200/mo in AB.');
    }
    if (has_vehicle && !current_coverage.includes('vehicle')) {
      gaps.push('Auto insurance — mandatory in Alberta');
      recs.push('Vehicle Insurance: $1M+ liability, comprehensive/collision. Quote: Intact, TD Insurance, Wawanesa. Est. $130–250/mo in AB.');
    }
    if (!current_coverage.includes('travel')) {
      gaps.push('Travel insurance — emergency medical outside Canada can exceed $1M');
      recs.push('Travel Insurance: Annual multi-trip plan recommended. Quote: Manulife Travel, Blue Cross Travel, TuGo. Est. $300–700/yr.');
    }

    const fallback = gaps.length === 0
      ? 'This client appears to have comprehensive coverage. Review annually as life circumstances change. Consider increasing life insurance as income grows and topping up disability coverage.'
      : `**Coverage Gap Analysis (AI Advisor — Offline Mode)**\n\nGAPS IDENTIFIED:\n${gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\nRECOMMENDED PRODUCTS:\n${recs.join('\n\n')}\n\nNote: These are estimated ranges based on typical Alberta market rates. Actual premiums depend on detailed underwriting. Contact the recommended insurers for formal quotes.`;

    return Response.json({ recommendation: fallback });
  }
}
