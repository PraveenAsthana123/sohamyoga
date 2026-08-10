import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  const base = `SELECT o.id, o.order_number, o.customer_email, o.status, o.payment_status, o.total,
                       o.created_at,
                       (SELECT COUNT(*) FROM order_item WHERE order_id = o.id) AS item_count,
                       (SELECT tracking_number FROM shipment WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) AS tracking_number
                FROM sales_order o`;
  const rows = status && status !== 'all'
    ? await query(`${base} WHERE o.status = $1 ORDER BY o.created_at DESC LIMIT 200`, [status])
    : await query(`${base} ORDER BY o.created_at DESC LIMIT 200`);

  return Response.json({
    orders: rows.rows.map((o) => ({
      id: o.id, number: o.order_number, customer: o.customer_email, status: o.status,
      payment: o.payment_status, total: Number(o.total), items: Number(o.item_count),
      date: o.created_at, tracking: o.tracking_number ?? undefined,
    })),
  });
}
