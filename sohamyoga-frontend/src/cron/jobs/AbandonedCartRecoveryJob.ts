// AbandonedCartRecoveryJob — Every 30 minutes
// Finds sales_order rows stalled in draft/pending for 2+ hours, drafts a
// personalized recovery message per cart (grounded in the actual items —
// never invents products), and stores it for staff to review and send
// manually. No auto-send: same draft-only pattern as draft_reply and the
// Quora manual queue elsewhere in this app.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function run(): Promise<void> {
  const stalled = await db.query<{
    id: string; customer_email: string; total: string; created_at: string;
  }>(
    `SELECT o.id, o.customer_email, o.total, o.created_at
     FROM sales_order o
     WHERE o.status IN ('draft', 'pending')
       AND o.created_at <= now() - interval '2 hours'
       AND o.created_at >= now() - interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM abandoned_cart_recovery r WHERE r.order_id = o.id)
     ORDER BY o.created_at LIMIT 20`,
  );

  let drafted = 0;
  for (const order of stalled.rows) {
    try {
      const items = await db.query<{ product_name: string; quantity: number; unit_price: string }>(
        `SELECT product_name, quantity, unit_price FROM order_item WHERE order_id = $1`,
        [order.id],
      );
      if (!items.rows.length) continue; // nothing real to recover — skip rather than invent a cart

      const cartSummary = items.rows.map(i => `${i.quantity}x ${i.product_name} ($${i.unit_price} each)`).join(', ');

      const response = await ollama.generate(
        `Cart items: ${cartSummary}\nCart total: $${order.total}\nHours since abandoned: ${Math.floor((Date.now() - new Date(order.created_at).getTime()) / 3_600_000)}`,
        {
          tier: 'fast', maxTokens: 300, timeoutMs: 45_000,
          system: `You are writing a short, low-pressure cart-recovery message for a yoga studio's online shop.
Reference only the exact items given — never invent a product, discount, or urgency claim not provided.
Return ONLY valid JSON: {"subject": "<=60 chars", "message": "2-3 short sentences, friendly, no guilt-tripping"}`,
        },
      );
      const draft = extractJson<{ subject: string; message: string }>(response);

      await db.query(
        `INSERT INTO abandoned_cart_recovery (order_id, customer_email, cart_summary, cart_total, subject, message)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (order_id) DO NOTHING`,
        [order.id, order.customer_email, cartSummary, order.total, draft.subject, draft.message],
      );
      drafted++;
    } catch (err) {
      console.error(`[abandoned-cart-recovery] order ${order.id}:`, err);
    }
  }

  console.log(`[abandoned-cart-recovery] scanned=${stalled.rows.length} drafted=${drafted}`);
  await db.end();
}
