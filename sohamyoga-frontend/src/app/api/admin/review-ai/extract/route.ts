export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { review_text } = await req.json();
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const prompt = `Extract entities from this customer review for a yoga/wellness business:
"${review_text}"

Return JSON:
{
  "people": ["names of staff/instructors mentioned"],
  "products": ["products or services mentioned"],
  "locations": ["locations mentioned"],
  "topics": ["main topics: instructor quality, pricing, scheduling, cleanliness, etc"],
  "key_phrases": ["impactful phrases from the review"],
  "sentiment": "positive|neutral|negative|mixed",
  "sentiment_score": 0.8,
  "products_mentioned": ["specific product names"],
  "staff_mentioned": ["specific staff names"]
}`;

  let entities: Record<string, unknown> = {};
  let sentiment = 'neutral';
  let topics: string[] = [];
  let products_mentioned: string[] = [];
  let staff_mentioned: string[] = [];

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    const match = (data.response || '').match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      entities = parsed;
      sentiment = (parsed.sentiment as string) || 'neutral';
      topics = (parsed.topics as string[]) || [];
      products_mentioned = (parsed.products_mentioned as string[]) || (parsed.products as string[]) || [];
      staff_mentioned = (parsed.staff_mentioned as string[]) || (parsed.people as string[]) || [];
    }
  } catch {
    // Simple fallback extraction
    sentiment = review_text.toLowerCase().match(/great|amazing|love|perfect|excellent|wonderful/) ? 'positive' :
                review_text.toLowerCase().match(/bad|terrible|awful|hate|worst|horrible/) ? 'negative' : 'neutral';
    entities = { key_phrases: ['Review analyzed with fallback'], sentiment };
    topics = ['general feedback'];
  }

  // Save to DB
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO review_entities (review_text, entities, sentiment, topics, products_mentioned, staff_mentioned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [review_text, JSON.stringify(entities), sentiment, topics, products_mentioned, staff_mentioned]
    );
    return Response.json({ extraction: rows[0], ai_generated: !!entities.people });
  } finally { client.release(); }
}
