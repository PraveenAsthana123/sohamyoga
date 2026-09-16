import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:latest';

const DEFAULT_ALLOCATIONS: Record<string, Record<string, number>> = {
  conservative:  { equities: 30, fixed_income: 60, alternatives: 5, cash: 5 },
  moderate:      { equities: 50, fixed_income: 40, alternatives: 7, cash: 3 },
  balanced:      { equities: 60, fixed_income: 30, alternatives: 7, cash: 3 },
  growth:        { equities: 75, fixed_income: 20, alternatives: 3, cash: 2 },
  aggressive:    { equities: 90, fixed_income: 5,  alternatives: 4, cash: 1 },
};

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id) return Response.json({ error: 'client_id required.' }, { status: 400 });

  const pool = getPool();
  const pgClient = await pool.connect();
  let clientData: Record<string, unknown> | null = null;
  let holdingsSummary = '';
  let currentAllocation: Record<string, number> = {};

  try {
    const clientRow = await pgClient.query(`SELECT * FROM fa_client WHERE id = $1`, [b.client_id]);
    clientData = clientRow.rows[0] ?? null;

    if (clientData) {
      const holdings = await pgClient.query(`
        SELECT h.fund_name, h.asset_class, h.geography, h.market_value, h.weight_pct, h.provider, h.mer_pct
        FROM fa_holding h
        JOIN fa_account a ON a.id = h.account_id
        WHERE a.client_id = $1 AND a.status = 'active'
        ORDER BY h.market_value DESC NULLS LAST
      `, [b.client_id]);

      const totalValue = holdings.rows.reduce((s, h) => s + Number(h.market_value || 0), 0);
      holdingsSummary = holdings.rows.map(h => {
        const pct = totalValue > 0 ? (Number(h.market_value || 0) / totalValue * 100).toFixed(1) : '0.0';
        return `${h.fund_name} (${h.asset_class ?? 'unknown'}, ${h.geography ?? 'unknown'}): ${pct}% — MER: ${h.mer_pct ?? '?'}%`;
      }).join('\n');

      // Current allocation by asset class
      for (const h of holdings.rows) {
        const cls = h.asset_class ?? 'unknown';
        currentAllocation[cls] = (currentAllocation[cls] || 0) + Number(h.market_value || 0);
      }
      if (totalValue > 0) {
        for (const cls in currentAllocation) {
          currentAllocation[cls] = Math.round(currentAllocation[cls] / totalValue * 100);
        }
      }
    }
  } finally {
    pgClient.release();
  }

  if (!clientData) return Response.json({ error: 'Client not found.' }, { status: 404 });

  const riskTolerance = (clientData.risk_tolerance as string) || 'moderate';
  const targetAllocation = b.target_allocation || DEFAULT_ALLOCATIONS[riskTolerance] || DEFAULT_ALLOCATIONS.moderate;

  const prompt = `You are a Canadian CFP specializing in portfolio rebalancing. Provide specific rebalancing advice.

CLIENT: ${clientData.name}, Risk Tolerance: ${riskTolerance}

CURRENT HOLDINGS:
${holdingsSummary || 'No holdings on file'}

CURRENT ALLOCATION (by asset class):
${JSON.stringify(currentAllocation, null, 2)}

TARGET ALLOCATION (for ${riskTolerance} risk):
${JSON.stringify(targetAllocation, null, 2)}

Provide:
1. DRIFT ANALYSIS — which asset classes are overweight/underweight and by how much
2. REBALANCING ACTIONS — specific buy/sell/hold recommendations with reasoning
3. TAX-EFFICIENT APPROACH — rebalance in RRSP/TFSA first (no tax), then non-registered; use new contributions before selling
4. RECOMMENDED CANADIAN PRODUCTS for underweight categories (ETFs: iShares, Vanguard Canada, BMO ETFs; Mutual funds: Manulife, Mackenzie, CI Financial)
5. MER REVIEW — flag any holdings with MER > 2% as candidates for lower-cost alternatives
6. TIMELINE — suggested rebalancing frequency

Keep under 500 words. Be specific and actionable.`;

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
      current_allocation: currentAllocation,
      target_allocation: targetAllocation,
      client: clientData,
    });
  } catch {
    const drifts = Object.entries(targetAllocation).map(([cls, target]) => {
      const current = currentAllocation[cls] ?? 0;
      const drift = current - target;
      return `${cls}: current ${current}% vs target ${target}% (${drift > 0 ? '+' : ''}${drift}%)`;
    }).join('\n');

    const fallback = `**Rebalance Advice — ${clientData.name} (Offline Mode)**

**Drift Analysis**
${drifts || 'No holdings to analyze — add holdings first'}

**General Rebalancing Strategy**
1. Rebalance in RRSP and TFSA first (no capital gains tax on trades inside registered accounts)
2. Use new contributions to top up underweight asset classes before selling overweight positions
3. In non-registered accounts, consider capital gains/losses timing before selling

**Recommended Low-Cost Canadian ETFs by Category**
- Canadian Equities: VCN (Vanguard), XIC (iShares), ZCN (BMO) — MER ~0.06%
- US Equities: VFV (Vanguard S&P500), XUS (iShares), ZSP (BMO) — MER ~0.09%
- International: VIU (Vanguard), XEF (iShares) — MER ~0.22%
- Fixed Income: VAB (Vanguard), XBB (iShares), ZAG (BMO) — MER ~0.09%
- Balanced One-Fund: VBAL, XBAL, ZBAL (~0.20% MER) for simplified management

**Rebalancing Frequency**
Review quarterly, rebalance when any asset class drifts >5% from target.`;

    return Response.json({
      advice: fallback,
      current_allocation: currentAllocation,
      target_allocation: targetAllocation,
      client: clientData,
      source: 'fallback',
    });
  }
}
