import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const vendorId = req.nextUrl.searchParams.get('vendorId');
  const base = `SELECT p.id, p.name, p.product_type, p.sku, p.base_price, p.stock, p.status, p.average_rating,
                       p.vendor_id, v.name AS vendor_name
                FROM product_master p LEFT JOIN vendor v ON v.id = p.vendor_id`;
  const rows = vendorId
    ? await query(`${base} WHERE p.vendor_id = $1 ORDER BY p.created_at DESC`, [vendorId])
    : await query(`${base} ORDER BY p.created_at DESC`);

  return Response.json({
    products: rows.rows.map((p) => ({
      id: p.id, name: p.name, type: p.product_type, sku: p.sku,
      price: Number(p.base_price), stock: p.stock, status: p.status,
      rating: Number(p.average_rating), vendor: p.vendor_name ?? undefined, vendorId: p.vendor_id ?? undefined,
    })),
  });
}

const PRODUCT_TYPES = new Set([
  'physical', 'digital', 'service', 'subscription', 'bundle', 'workshop',
  'retreat', 'course', 'gift_card', 'ayurvedic', 'book', 'membership',
]);

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function skuFrom(name: string): string {
  return slugify(name).toUpperCase().slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// POST /api/ecommerce/products — vendor/admin creates a listing. Services
// (product_type='service') don't track inventory, so `stock` is ignored for them.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; productType?: string; shortDescription?: string; description?: string;
    basePrice?: number; vendorId?: string; categorySlug?: string; durationMinutes?: number;
  } | null;

  if (!body?.name?.trim()) return Response.json({ error: 'Product name is required.' }, { status: 400 });
  if (!body.productType || !PRODUCT_TYPES.has(body.productType)) {
    return Response.json({ error: `productType must be one of: ${Array.from(PRODUCT_TYPES).join(', ')}` }, { status: 400 });
  }
  if (typeof body.basePrice !== 'number' || body.basePrice < 0) {
    return Response.json({ error: 'basePrice must be a non-negative number.' }, { status: 400 });
  }
  if (body.vendorId) {
    const vendor = await query<{ status: string }>(`SELECT status FROM vendor WHERE id = $1`, [body.vendorId]);
    if (!vendor.rows.length) return Response.json({ error: 'Vendor not found.' }, { status: 404 });
    if (vendor.rows[0].status !== 'active') {
      return Response.json({ error: 'Vendor must be active before listing products.' }, { status: 403 });
    }
  }

  const categories = body.categorySlug ? [body.categorySlug] : [];
  const isService = body.productType === 'service' || body.productType === 'workshop' || body.productType === 'course';

  const result = await query<{ id: string }>(
    `INSERT INTO product_master
     (name, slug, product_type, status, description, short_description, base_price, sku,
      track_inventory, stock, requires_shipping, vendor_id, duration_minutes, categories, created_by)
     VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'admin')
     RETURNING id`,
    [
      body.name.trim(), slugify(body.name) + '-' + Date.now().toString(36), body.productType,
      body.description ?? '', body.shortDescription ?? '', body.basePrice, skuFrom(body.name),
      !isService, isService ? 0 : 0, !isService, body.vendorId ?? null,
      body.durationMinutes ?? null, categories,
    ],
  );

  return Response.json({ ok: true, id: result.rows[0].id, status: 'draft' }, { status: 201 });
}
