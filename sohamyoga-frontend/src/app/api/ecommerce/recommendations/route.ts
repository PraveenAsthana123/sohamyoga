// GET /api/ecommerce/recommendations?segment=high_value
// Ollama picks and ranks products FROM THE REAL CATALOG for a given customer
// segment — grounded, not generative: the prompt lists actual product_master
// rows and the model may only return ids that were in that list. Any id it
// invents anyway is discarded rather than shown as a "real" recommendation.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { ollama } from '@/cron/OllamaClient';
import { CAMPAIGN_SEGMENTS } from '@/cron/campaignSegments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEGMENT_KEYS = new Set(CAMPAIGN_SEGMENTS.map(s => s.key));

interface CatalogRow { id: string; name: string; product_type: string; base_price: string; short_description: string | null }

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const segmentKey = req.nextUrl.searchParams.get('segment');
  if (!segmentKey || !SEGMENT_KEYS.has(segmentKey)) {
    return Response.json({ error: `segment must be one of: ${Array.from(SEGMENT_KEYS).join(', ')}` }, { status: 400 });
  }
  const segment = CAMPAIGN_SEGMENTS.find(s => s.key === segmentKey)!;

  const catalog = await query<CatalogRow>(
    `SELECT id, name, product_type, base_price, short_description
     FROM product_master WHERE status = 'active' ORDER BY average_rating DESC, created_at DESC LIMIT 30`,
  );
  if (!catalog.rows.length) {
    return Response.json({ segment: segment.label, recommendations: [], note: 'No active products in the catalog yet.' });
  }

  const catalogText = catalog.rows
    .map(p => `- id=${p.id} | ${p.name} (${p.product_type}, $${p.base_price})${p.short_description ? ` — ${p.short_description}` : ''}`)
    .join('\n');

  const response = await ollama.generate(
    `Catalog:\n${catalogText}\n\nAudience segment: ${segment.label}\nTone/context: ${segment.toneGuidance}`,
    {
      tier: 'strong', timeoutMs: 90_000, maxTokens: 500,
      system: `You are a merchandising assistant for a yoga studio's product catalog.
Given a list of real catalog products (with their exact ids) and a customer segment,
pick the 3-5 products from THAT LIST most likely to resonate with this segment.
You must only use ids that appear in the provided catalog — never invent a product or id.
Return ONLY valid JSON: {"picks": [{"id": "<exact id from catalog>", "reason": "one short sentence"}]}`,
    },
  );

  let parsed: { picks?: { id: string; reason: string }[] };
  try {
    parsed = extractJson(response);
  } catch {
    return Response.json({ error: 'Ollama returned an unparseable response.' }, { status: 502 });
  }

  const catalogById = new Map(catalog.rows.map(p => [p.id, p]));
  const grounded = (parsed.picks ?? [])
    .filter(pick => catalogById.has(pick.id))
    .map(pick => {
      const product = catalogById.get(pick.id)!;
      return { id: product.id, name: product.name, type: product.product_type, price: Number(product.base_price), reason: pick.reason };
    });
  const droppedCount = (parsed.picks?.length ?? 0) - grounded.length;

  return Response.json({
    segment: segment.label,
    recommendations: grounded,
    ...(droppedCount > 0 ? { note: `${droppedCount} pick(s) referenced a product not in the catalog and were dropped.` } : {}),
  });
}
