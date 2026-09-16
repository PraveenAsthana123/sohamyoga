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
    const cart = await client.query(
      `SELECT * FROM shopify_abandoned_carts WHERE id=$1 AND store_domain=$2`,
      [params.id, params.domain]
    );
    if (cart.rowCount === 0) return Response.json({ error: 'Cart not found.' }, { status: 404 });
    const c = cart.rows[0];

    const items = Array.isArray(c.items) ? c.items : JSON.parse(c.items || '[]') as { title?: string }[];
    const itemList = items.map((i: { title?: string }) => i.title || 'item').join(', ');
    const prompt = `Write a friendly, personalized abandoned cart recovery email for a yoga studio.

Customer: ${c.customer_name}
Cart items: ${itemList}
Cart total: $${c.total_price}

Write:
1. Subject line (engaging, max 60 chars)
2. Email body (warm, encouraging, 150-200 words) with a clear call-to-action to complete purchase

JSON format: {"subject":"...","body":"..."}`;

    let subject = '';
    let body = '';

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
          const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
          subject = parsed.subject || '';
          body = parsed.body || '';
        }
      }
    } catch {
      // Ollama unavailable — use fallback
    }

    if (!subject) {
      subject = `${c.customer_name}, your cart is waiting for you!`;
      body = `Hi ${c.customer_name},\n\nWe noticed you left some amazing items in your cart — including ${itemList}. Your total of $${c.total_price} is ready and waiting.\n\nAt Soham Yoga, we believe in supporting your wellness journey every step of the way. Don't let these items go — complete your purchase today and take the next step in your practice.\n\nUse code COMEBACK10 for 10% off your order.\n\nNamaste,\nThe Soham Yoga Team`;
    }

    await client.query(
      `UPDATE shopify_abandoned_carts SET recovery_email_sent=TRUE WHERE id=$1`,
      [params.id]
    );

    return Response.json({ ok: true, subject, body });
  } finally {
    client.release();
  }
}
