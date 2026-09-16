import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

interface RawRecommendation {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  expected_lift_pct?: unknown;
  priority?: unknown;
}

interface RetailProduct {
  id: string;
  name: string;
  category: string | null;
  price: string | null;
  cost: string | null;
  stock_qty: number;
  sold_30d: number;
  sold_90d: number;
  return_rate: string | null;
  avg_rating: string | null;
}

function ruleBasedRecommendations(product: RetailProduct): RawRecommendation[] {
  const recs: RawRecommendation[] = [];
  const stock = product.stock_qty ?? 0;
  const sold30d = product.sold_30d ?? 0;
  const returnRate = parseFloat(product.return_rate ?? '0');
  const rating = parseFloat(product.avg_rating ?? '0');

  if (stock < 10 && sold30d > 20) {
    recs.push({
      type: 'reorder_alert',
      priority: 'high',
      title: 'Reorder now — low stock',
      description: `Only ${stock} units remain but you sold ${sold30d} units last month. Reorder immediately to avoid stockout.`,
      expected_lift_pct: 18.0,
    });
  }
  if (returnRate > 0.15) {
    recs.push({
      type: 'review_quality',
      priority: 'high',
      title: 'High return rate — quality review needed',
      description: `Return rate of ${(returnRate * 100).toFixed(1)}% is above the 15% threshold. Investigate product quality or description mismatch.`,
      expected_lift_pct: -5.0,
    });
  }
  if (sold30d === 0) {
    recs.push({
      type: 'discontinue',
      priority: 'medium',
      title: 'No sales in 30 days — consider discontinuing',
      description: 'Zero units sold in the last 30 days. Consider a promotional push, repackaging, or discontinuing this SKU.',
      expected_lift_pct: 0.0,
    });
  }
  if (rating >= 4.5 && sold30d > 10) {
    recs.push({
      type: 'promote',
      priority: 'medium',
      title: 'Top performer — increase ad spend',
      description: `${rating} avg rating with ${sold30d} units sold last month. Scaling ad spend 20-30% is likely to yield positive ROI.`,
      expected_lift_pct: 22.0,
    });
  }
  if (recs.length === 0) {
    recs.push({
      type: 'price_change',
      priority: 'low',
      title: 'Review pricing vs competitors',
      description: 'Run a competitive price analysis to ensure pricing is optimally positioned in the market.',
      expected_lift_pct: 5.0,
    });
  }
  return recs;
}

async function callOllama(prompt: string): Promise<RawRecommendation[] | null> {
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
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as RawRecommendation[];
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { product_id?: unknown; context?: unknown };
  try {
    body = await req.json() as { product_id?: unknown; context?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
  if (!productId) {
    return Response.json({ error: 'product_id is required' }, { status: 400 });
  }

  const pool = getPool();

  const productResult = await pool.query<RetailProduct>(
    `SELECT id, name, category, price, cost, stock_qty, sold_30d, sold_90d, return_rate, avg_rating
     FROM retail_products WHERE id = $1`,
    [productId],
  );

  if (!productResult.rows.length) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = productResult.rows[0];
  const returnRatePct = (parseFloat(product.return_rate ?? '0') * 100).toFixed(1);
  const context = typeof body.context === 'string' ? body.context : '';

  const prompt = `You are a retail AI. A product has: name=${product.name}, category=${product.category ?? 'unknown'}, price=${product.price}, sold_30d=${product.sold_30d}, sold_90d=${product.sold_90d}, stock=${product.stock_qty}, return_rate=${returnRatePct}%, avg_rating=${product.avg_rating}.${context ? ` Additional context: ${context}` : ''}
Generate 3 specific actionable recommendations (bundle opportunity, pricing, promotion, or inventory action).
Respond as JSON array: [{"type": "...", "title": "...", "description": "...", "expected_lift_pct": 0.0, "priority": "high|medium|low"}]
Types allowed: product_bundle, reorder_alert, price_change, discontinue, promote, review_quality`;

  let rawRecs = await callOllama(prompt);
  const aiSource = rawRecs ? 'ollama' : 'rule_based';

  if (!rawRecs || !rawRecs.length) {
    rawRecs = ruleBasedRecommendations(product);
  }

  const saved = [];
  for (const rec of rawRecs.slice(0, 3)) {
    const type = typeof rec.type === 'string' ? rec.type : 'price_change';
    const title = typeof rec.title === 'string' ? rec.title : 'AI Recommendation';
    const description = typeof rec.description === 'string' ? rec.description : null;
    const expectedLift = typeof rec.expected_lift_pct === 'number' ? rec.expected_lift_pct : null;
    const priority = ['high', 'medium', 'low'].includes(String(rec.priority)) ? String(rec.priority) : 'medium';

    try {
      const inserted = await pool.query<{ id: string; created_at: string }>(
        `INSERT INTO retail_ai_recommendations
           (recommendation_type, product_id, title, description, expected_lift_pct, priority, status, ai_source)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id, created_at`,
        [type, productId, title, description, expectedLift, priority, aiSource],
      );
      saved.push({
        id: inserted.rows[0].id,
        recommendation_type: type,
        product_id: productId,
        title,
        description,
        expected_lift_pct: expectedLift,
        priority,
        status: 'pending',
        ai_source: aiSource,
        created_at: inserted.rows[0].created_at,
      });
    } catch (err) {
      console.error('[retail-ai/recommend] insert error:', err);
    }
  }

  return Response.json({ recommendations: saved, ai_source: aiSource, product_name: product.name });
}
