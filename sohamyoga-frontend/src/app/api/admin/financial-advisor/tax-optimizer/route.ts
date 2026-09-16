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
  let accountTypes: string[] = [];

  try {
    const clientRow = await pgClient.query(`SELECT * FROM fa_client WHERE id = $1`, [b.client_id]);
    clientData = clientRow.rows[0] ?? null;
    if (clientData) {
      const accounts = await pgClient.query(
        `SELECT DISTINCT account_type FROM fa_account WHERE client_id = $1 AND status = 'active'`,
        [b.client_id]
      );
      accountTypes = accounts.rows.map((r: { account_type: string }) => r.account_type);
    }
  } finally {
    pgClient.release();
  }

  if (!clientData) return Response.json({ error: 'Client not found.' }, { status: 404 });

  const c = clientData;
  const prompt = `You are a Canadian tax specialist and CFP. Provide specific Canadian tax optimization tips for this client.

CLIENT PROFILE:
- Province: ${c.province} (use ${c.province} provincial tax rates)
- Annual Income: $${Number(c.annual_income || 0).toLocaleString('en-CA')} CAD
- Marginal Tax Bracket: ${c.tax_bracket ?? 'Unknown'}%
- RRSP Room Available: $${Number(c.rrsp_room || 0).toLocaleString('en-CA')}
- TFSA Room Available: $${Number(c.tfsa_room || 0).toLocaleString('en-CA')}
- FHSA Eligible: ${c.fhsa_eligible ? 'Yes ($8,000/yr, lifetime $40,000)' : 'No'}
- Primary Goal: ${c.primary_goal ?? 'Not specified'}
- Current Accounts: ${accountTypes.join(', ') || 'None on file'}

Provide CANADIAN TAX OPTIMIZATION advice covering:
1. RRSP vs TFSA PRIORITY — at their income/bracket, which is more advantageous and why
2. INCOME SPLITTING strategies (spousal RRSP, pension income splitting, family trust considerations)
3. CAPITAL GAINS TIMING — crystallize gains/losses; use the annual capital gains inclusion rate
4. RESP & CESG — if primary goal includes education, $2,500/yr contribution = $500 CESG grant
5. FHSA — if eligible, $8,000/yr fully deductible AND withdrawals tax-free for first home
6. DIVIDENDS vs SALARY — if self-employed, optimal compensation mix
7. ${c.province} PROVINCIAL TAX TIPS — specific to their province (Alberta has no provincial sales tax, no provincial capital tax)
8. CPP OPTIMIZATION — when to start CPP (60-70), deferral benefits
9. OAS CLAWBACK AVOIDANCE — strategies if income near $81,761 (2024 OAS threshold)
10. ESTATE PLANNING — spousal rollover, beneficiary designations, capital gains on death

Keep response under 600 words. Be specific to Canada (CRA rules, current contribution limits, CPP/OAS numbers).`;

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
    const data = await resp.json() as { response?: string };
    return Response.json({ tips: data.response ?? '', client: clientData });
  } catch {
    const bracket = Number(c.tax_bracket || 33);
    const rrspSaving = Math.round(Number(c.rrsp_room || 0) * bracket / 100);

    const fallback = `**Canadian Tax Optimizer — ${c.name} (Offline Mode)**

**RRSP vs TFSA Priority**
${bracket >= 33
  ? `At ${bracket}% marginal rate, RRSP is generally preferred. Full RRSP room ($${Number(c.rrsp_room || 0).toLocaleString('en-CA')}) could save ~$${rrspSaving.toLocaleString('en-CA')} in taxes this year.`
  : `At ${bracket}% marginal rate, TFSA may be preferred if you expect higher income (and higher tax rate) in retirement. Consider splitting contributions.`}

**FHSA — First Home Savings Account**
${c.fhsa_eligible
  ? 'ELIGIBLE: Contribute $8,000/year — fully deductible (like RRSP) AND withdrawals tax-free for first home purchase. Lifetime max $40,000. Unused room carries forward. Open immediately — do not delay as the account must be open 1+ year before tax-free withdrawal.'
  : 'Not eligible (already a homeowner or over age limit).'}

**Income Splitting**
- Spousal RRSP: Contribute to spouse's RRSP if they'll be in a lower bracket in retirement — withdrawals taxed at their lower rate (attribution rules apply for 3 years)
- Pension income splitting: Split up to 50% of eligible pension income with spouse on tax return (no spousal RRSP needed for this)

**Capital Gains**
- 2024 inclusion rate: 2/3 above $250,000 (individual), 2/3 on all amounts (corporations/trusts). Time large dispositions to avoid triggering above threshold in one year.
- Capital loss harvesting: Sell underperforming non-registered holdings at year-end to offset capital gains (superficial loss rule: don't repurchase same/identical security within 30 days)

**${c.province} Tax Tips**
${c.province === 'AB' ? '- Alberta has no provincial sales tax (PST) — advantage for business owners\n- Alberta top combined rate: ~48% — aggressive RRSP contributions are high priority' : '- Check your provincial tax rates and tax credits at the CRA website'}

**CPP & OAS**
- Every year of CPP deferral past 65 increases benefit by 8.4% (max at 70: 42% more than at 65)
- OAS clawback (2024): income above ~$81,761 reduces OAS at 15¢ per dollar — consider RRSP withdrawals before 65 to manage RRIF minimum withdrawals and OAS clawback

**Key 2024 CRA Numbers**
- RRSP limit: $31,560, TFSA limit: $7,000, FHSA: $8,000, CESG (RESP): 20% on first $2,500/child`;

    return Response.json({ tips: fallback, client: clientData, source: 'fallback' });
  }
}
