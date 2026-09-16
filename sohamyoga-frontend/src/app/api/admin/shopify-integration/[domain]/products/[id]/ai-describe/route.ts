export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { domain: string; id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const product = await client.query(
      `SELECT * FROM shopify_products WHERE id=$1 AND store_domain=$2`,
      [params.id, params.domain]
    );
    if (product.rowCount === 0) return Response.json({ error: 'Product not found.' }, { status: 404 });
    const p = product.rows[0];

    const prompt = `You are an expert e-commerce copywriter for a yoga and wellness brand. Given the product below, write:
1. An SEO-optimized product description (150-200 words) that highlights benefits, features, and who it's for.
2. Exactly 5 SEO tags (comma-separated) relevant to the product.

Product: ${p.title}
Price: $${p.price}
Category: Yoga & Wellness

Respond in this exact JSON format:
{"description": "...", "tags": ["tag1","tag2","tag3","tag4","tag5"]}`;

    let description = '';
    let tags: string[] = [];

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json() as { response?: string };
        const raw = ollamaData.response || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { description?: string; tags?: string[] };
          description = parsed.description || '';
          tags = parsed.tags || [];
        }
      }
    } catch {
      // Ollama unavailable — use fallback
    }

    if (!description) {
      description = `Discover the ${p.title} — a premium addition to your yoga and wellness practice. Crafted with quality and intentionality, this product supports your journey toward balance, strength, and mindfulness. Whether you're a beginner finding your flow or an advanced practitioner deepening your practice, the ${p.title} delivers exceptional value at $${p.price}. Designed for the modern yogi, it combines functionality with sustainability, making it an essential part of your wellness toolkit. Elevate your practice and invest in your wellbeing today.`;
      tags = ['yoga', 'wellness', 'mindfulness', p.title.toLowerCase().split(' ')[0], 'studio'];
    }

    await client.query(
      `UPDATE shopify_products SET ai_description=$1, tags=$2 WHERE id=$3`,
      [description, tags, params.id]
    );

    return Response.json({ ok: true, description, tags });
  } finally {
    client.release();
  }
}
