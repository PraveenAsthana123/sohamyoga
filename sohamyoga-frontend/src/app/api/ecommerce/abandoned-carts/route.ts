import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; order_id: string; customer_email: string; cart_summary: string; cart_total: string;
    subject: string; message: string; status: string; detected_at: string;
  }>(
    `SELECT id, order_id, customer_email, cart_summary, cart_total, subject, message, status, detected_at
     FROM abandoned_cart_recovery WHERE status = 'draft' ORDER BY detected_at DESC`,
  );

  return Response.json({
    drafts: rows.rows.map(r => ({
      id: r.id, orderId: r.order_id, customerEmail: r.customer_email, cartSummary: r.cart_summary,
      cartTotal: Number(r.cart_total), subject: r.subject, message: r.message, status: r.status, detectedAt: r.detected_at,
    })),
  });
}
