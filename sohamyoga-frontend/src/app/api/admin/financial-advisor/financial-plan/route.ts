import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:latest';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id) return Response.json({ error: 'client_id required.' }, { status: 400 });

  const pool = getPool();
  const pgClient = await pool.connect();
  let clientData: Record<string, unknown> | null = null;
  let accountsSummary = '';

  try {
    const clientRow = await pgClient.query(`SELECT * FROM fa_client WHERE id = $1`, [b.client_id]);
    if (clientRow.rows[0]) {
      clientData = clientRow.rows[0];
      const accounts = await pgClient.query(`
        SELECT account_type, institution, current_value, annual_contribution
        FROM fa_account WHERE client_id = $1 AND status = 'active'
        ORDER BY current_value DESC
      `, [b.client_id]);
      accountsSummary = accounts.rows.map(a =>
        `${a.account_type} at ${a.institution}: $${Number(a.current_value).toLocaleString('en-CA')} (contrib: $${Number(a.annual_contribution || 0).toLocaleString('en-CA')}/yr)`
      ).join('\n');
    }
  } finally {
    pgClient.release();
  }

  if (!clientData) return Response.json({ error: 'Client not found.' }, { status: 404 });

  const c = clientData;
  const age = c.date_of_birth
    ? Math.floor((Date.now() - new Date(c.date_of_birth as string).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const retireIn = age && c.retirement_age_target ? Number(c.retirement_age_target) - age : null;

  const prompt = `You are a Canadian Certified Financial Planner (CFP). Generate a comprehensive financial plan for this client.

CLIENT PROFILE:
- Name: ${c.name}
- Age: ${age ?? 'Unknown'}
- Province: ${c.province}
- Employment: ${c.employment_status ?? 'Unknown'}
- Annual Income: $${Number(c.annual_income || 0).toLocaleString('en-CA')} CAD
- Investable Assets: $${Number(c.investable_assets || 0).toLocaleString('en-CA')} CAD
- Net Worth: $${Number(c.net_worth || 0).toLocaleString('en-CA')} CAD
- Risk Tolerance: ${c.risk_tolerance}
- Investment Horizon: ${c.investment_horizon ?? 'Not specified'}
- Primary Goal: ${c.primary_goal ?? 'Not specified'}
- Retirement Target Age: ${c.retirement_age_target ?? 'Not specified'} ${retireIn ? `(${retireIn} years away)` : ''}
- Tax Bracket: ${c.tax_bracket ?? 'Unknown'}%
- RRSP Room: $${Number(c.rrsp_room || 0).toLocaleString('en-CA')}
- TFSA Room: $${Number(c.tfsa_room || 0).toLocaleString('en-CA')}
- FHSA Eligible: ${c.fhsa_eligible ? 'Yes' : 'No'}

CURRENT ACCOUNTS:
${accountsSummary || 'No accounts on file'}

Generate a structured financial plan covering:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. RRSP STRATEGY — contribution amount, timing, tax savings at their bracket
3. TFSA STRATEGY — optimal use given their goal and tax situation
4. FHSA STRATEGY (if eligible) — $8,000/yr contribution, tax deduction + tax-free growth
5. RESP (if client has dependents noted in goal) — CESG grant strategy
6. RETIREMENT PROJECTION — estimated retirement income at target age, CPP/OAS estimates, savings gap
7. INVESTMENT ALLOCATION — recommended asset mix by risk tolerance (equities/fixed income/alternatives %)
8. RECOMMENDED PROVIDERS — specific Canadian funds/ETFs/institutions by account type
9. TAX OPTIMIZATION — income splitting, capital gains timing, RRSP vs TFSA priority
10. NEXT STEPS — top 3 action items this year

Be specific, practical, and use Canadian financial context (CDIC, CRA contribution rules, CPP/OAS, Alberta/provincial tax rates).
Keep total response under 800 words.`;

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
    const data = await resp.json() as { response?: string };
    return Response.json({ plan: data.response ?? '', client: clientData });
  } catch {
    const fallback = `**Financial Plan — ${c.name} (Offline Mode)**

**Executive Summary**
Based on your profile, the priority is maximizing tax-sheltered savings through RRSP and TFSA, aligned with your ${c.risk_tolerance} risk tolerance and ${c.primary_goal ?? 'wealth-building'} goal.

**RRSP Strategy**
Contribute up to your RRSP room ($${Number(c.rrsp_room || 0).toLocaleString('en-CA')}) before the deadline. At ${c.tax_bracket ?? '33'}% marginal rate, every $1,000 contributed saves approximately $${Math.round(Number(c.tax_bracket || 33) * 10)} in taxes. Recommended providers: Questrade (self-directed), Wealthsimple (robo), Manulife/Sun Life (segregated funds for guarantee).

**TFSA Strategy**
Maximize TFSA room ($${Number(c.tfsa_room || 0).toLocaleString('en-CA')}) with growth-oriented investments — all growth is tax-free. Ideal for flexible, accessible savings.

**FHSA Strategy**
${c.fhsa_eligible ? 'Eligible — contribute $8,000/year (lifetime max $40,000). Deductible like RRSP, withdrawals tax-free for first home purchase. Open immediately at any major bank or Questrade.' : 'Not eligible (already a homeowner or age restriction).'}

**Retirement Projection**
${retireIn ? `With ${retireIn} years to retirement, consistent annual contributions of ${Math.round(Number(c.annual_income || 0) * 0.15).toLocaleString('en-CA')} (15% of income) could accumulate $${Math.round(Number(c.annual_income || 0) * 0.15 * retireIn * 1.06).toLocaleString('en-CA')} at 6% avg return.` : 'Set a retirement age target to generate a projection.'}

**Recommended Asset Mix (${c.risk_tolerance})**
${c.risk_tolerance === 'conservative' ? '30% equities / 60% fixed income / 10% cash' :
  c.risk_tolerance === 'moderate' ? '50% equities / 40% fixed income / 10% alternatives' :
  c.risk_tolerance === 'balanced' ? '60% equities / 30% fixed income / 10% alternatives' :
  c.risk_tolerance === 'growth' ? '75% equities / 20% fixed income / 5% alternatives' :
  '90% equities / 5% fixed income / 5% alternatives'}

**Top 3 Action Items**
1. Maximize RRSP contribution before March 1 deadline
2. Open and contribute to TFSA for tax-free growth${c.fhsa_eligible ? '\n3. Open FHSA immediately — $8,000 deduction + tax-free home purchase' : '\n3. Review beneficiary designations on all accounts'}`;

    return Response.json({ plan: fallback, client: clientData, source: 'fallback' });
  }
}
