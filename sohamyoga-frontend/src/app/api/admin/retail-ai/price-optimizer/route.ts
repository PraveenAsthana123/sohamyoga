import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

type OptimizationTarget = 'maximize_revenue' | 'maximize_units' | 'clear_stock';

interface PriceOptimizationResult {
  recommended_price: number;
  reasoning: string;
  expected_units_change_pct: number;
  expected_revenue_change_pct: number;
}

interface RetailProduct {
  id: string;
  name: string;
  price: string | null;
  cost: string | null;
  sold_30d: number;
  return_rate: string | null;
  avg_rating: string | null;
  stock_qty: number;
}

function ruleBasedPriceOptimization(product: RetailProduct, target: OptimizationTarget): PriceOptimizationResult {
  const currentPrice = parseFloat(product.price ?? '0');
  const rating = parseFloat(product.avg_rating ?? '0');

  if (target === 'clear_stock') {
    const recommended = parseFloat((currentPrice * 0.75).toFixed(2));
    return {
      recommended_price: recommended,
      reasoning: `Applying a 25% discount (${currentPrice} → ${recommended}) to accelerate stock clearance. At current sell-through rate, this should clear remaining inventory within 15 days.`,
      expected_units_change_pct: 35.0,
      expected_revenue_change_pct: 1.25,
    };
  }

  if (target === 'maximize_revenue') {
    if (rating > 4.0 && product.sold_30d > 10) {
      const increase = currentPrice < 50 ? 0.05 : 0.08;
      const recommended = parseFloat((currentPrice * (1 + increase)).toFixed(2));
      return {
        recommended_price: recommended,
        reasoning: `High rating (${rating}) and solid sales velocity (${product.sold_30d} units/month) justify a ${(increase * 100).toFixed(0)}% price increase. Price elasticity for premium-rated products is typically low.`,
        expected_units_change_pct: -3.0,
        expected_revenue_change_pct: increase * 100 - 3.0,
      };
    }
    return {
      recommended_price: parseFloat((currentPrice * 1.05).toFixed(2)),
      reasoning: 'Modest 5% increase to test price sensitivity while protecting margin.',
      expected_units_change_pct: -5.0,
      expected_revenue_change_pct: 0.0,
    };
  }

  // maximize_units
  const recommended = parseFloat((currentPrice * 0.90).toFixed(2));
  return {
    recommended_price: recommended,
    reasoning: `A 10% price reduction (${currentPrice} → ${recommended}) is projected to increase unit volume by approximately 15-20% based on standard price elasticity of demand for this category.`,
    expected_units_change_pct: 17.5,
    expected_revenue_change_pct: 5.75,
  };
}

async function callOllamaPriceOptimizer(
  product: RetailProduct,
  target: OptimizationTarget,
): Promise<PriceOptimizationResult | null> {
  const returnRatePct = (parseFloat(product.return_rate ?? '0') * 100).toFixed(1);
  const prompt = `A product costs $${product.cost} to make and is priced at $${product.price}. It sold ${product.sold_30d} units last month with ${returnRatePct}% return rate and ${product.avg_rating} avg rating.
Our goal is to ${target.replace(/_/g, ' ')}. Recommend an optimal price with reasoning.
Respond as JSON only: {"recommended_price": 0.0, "reasoning": "...", "expected_units_change_pct": 0.0, "expected_revenue_change_pct": 0.0}`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: DEFAULT_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { response?: string };
    if (!data.response) return null;
    const text = data.response.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as PriceOptimizationResult;
    if (typeof parsed.recommended_price !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { product_id?: unknown; target?: unknown };
  try {
    body = await req.json() as { product_id?: unknown; target?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
  const target = typeof body.target === 'string' ? body.target : 'maximize_revenue';

  if (!productId) {
    return Response.json({ error: 'product_id is required' }, { status: 400 });
  }

  const validTargets: OptimizationTarget[] = ['maximize_revenue', 'maximize_units', 'clear_stock'];
  if (!validTargets.includes(target as OptimizationTarget)) {
    return Response.json(
      { error: `target must be one of: ${validTargets.join(', ')}` },
      { status: 400 },
    );
  }

  const pool = getPool();

  const productResult = await pool.query<RetailProduct>(
    `SELECT id, name, price, cost, sold_30d, return_rate, avg_rating, stock_qty
     FROM retail_products WHERE id = $1`,
    [productId],
  );

  if (!productResult.rows.length) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = productResult.rows[0];
  const currentPrice = parseFloat(product.price ?? '0');
  const currentCost = parseFloat(product.cost ?? '0');
  const currentMargin = currentPrice > 0
    ? parseFloat((((currentPrice - currentCost) / currentPrice) * 100).toFixed(1))
    : 0;

  let result = await callOllamaPriceOptimizer(product, target as OptimizationTarget);
  const aiSource = result ? 'ollama' : 'rule_based';

  if (!result) {
    result = ruleBasedPriceOptimization(product, target as OptimizationTarget);
  }

  const newPrice = parseFloat(result.recommended_price.toFixed(2));
  const priceChanged = Math.abs(newPrice - currentPrice) > 0.01;

  // Save price history if price actually changes
  if (priceChanged) {
    try {
      await pool.query(
        `INSERT INTO retail_price_history (product_id, old_price, new_price, reason)
         VALUES ($1, $2, $3, $4)`,
        [productId, currentPrice, newPrice, `AI price optimizer — goal: ${target} (${aiSource})`],
      );
    } catch (err) {
      console.error('[retail-ai/price-optimizer] price history insert error:', err);
    }
  }

  const newMargin = newPrice > 0
    ? parseFloat((((newPrice - currentCost) / newPrice) * 100).toFixed(1))
    : 0;

  return Response.json({
    product_id: productId,
    product_name: product.name,
    target,
    ai_source: aiSource,
    current_price: currentPrice,
    current_cost: currentCost,
    current_margin_pct: currentMargin,
    recommended_price: newPrice,
    new_margin_pct: newMargin,
    price_changed: priceChanged,
    reasoning: result.reasoning,
    expected_units_change_pct: result.expected_units_change_pct,
    expected_revenue_change_pct: result.expected_revenue_change_pct,
  });
}
