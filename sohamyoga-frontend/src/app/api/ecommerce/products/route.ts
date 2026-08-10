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
    id: string; name: string; product_type: string; sku: string; base_price: string; stock: number;
    status: string; average_rating: string; vendor_name: string | null;
  }>(
    `SELECT p.id, p.name, p.product_type, p.sku, p.base_price, p.stock, p.status, p.average_rating,
            v.name AS vendor_name
     FROM product_master p LEFT JOIN vendor v ON v.id = p.vendor_id
     ORDER BY p.created_at DESC`,
  );

  return Response.json({
    products: rows.rows.map(p => ({
      id: p.id, name: p.name, type: p.product_type, sku: p.sku,
      price: Number(p.base_price), stock: p.stock, status: p.status,
      rating: Number(p.average_rating), vendor: p.vendor_name ?? undefined,
    })),
  });
}
