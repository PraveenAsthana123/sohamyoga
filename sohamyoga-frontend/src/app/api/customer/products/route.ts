import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real public product catalog for /customer/shop -- product_master and the
// cart-to-order flow (customer/cart) were already real, but nothing let a
// customer discover a productId to add: /api/ecommerce/products is
// requireAdmin-gated and there was no customer-facing browse route at all.
// This is the missing storefront half of an already-real cart/checkout.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; description: string | null; product_type: string; sku: string;
    base_price: string; stock: number | null; track_inventory: boolean;
  }>(
    `SELECT id, name, description, product_type, sku, base_price, stock, track_inventory
     FROM product_master WHERE status = 'active' ORDER BY created_at DESC LIMIT 200`,
  );

  return Response.json({
    products: rows.rows.map(p => ({
      id: p.id, name: p.name, description: p.description, type: p.product_type, sku: p.sku,
      price: Number(p.base_price),
      inStock: !p.track_inventory || (p.stock ?? 0) > 0,
    })),
  });
}
