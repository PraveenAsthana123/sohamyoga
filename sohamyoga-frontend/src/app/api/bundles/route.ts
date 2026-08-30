import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { Bundle, type BundleType, type BundleItemType } from '@/domain/pricing/Bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bundles — catalog templates (bundle_master) with real item lists and real
// sold/active-ownership counts computed from bundle_ownership. Never fabricated.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [bundles, items, owned] = await Promise.all([
    query(
      `SELECT id, name, slug, bundle_type, description, status, base_price, discounted_price, currency,
              expiry_days, is_mix_and_match, is_giftable, is_transferable, seats_total, created_at, updated_at
       FROM bundle_master ORDER BY created_at DESC`,
    ),
    query(`SELECT id, bundle_id, item_type, name, quantity, product_id, class_category, sort_order FROM bundle_item ORDER BY sort_order`),
    query<{ bundle_id: string; sold: string; active: string }>(
      `SELECT bundle_id, COUNT(*) AS sold, COUNT(*) FILTER (WHERE status = 'active') AS active
       FROM bundle_ownership GROUP BY bundle_id`,
    ),
  ]);

  const itemsByBundle = new Map<string, typeof items.rows>();
  for (const it of items.rows) {
    const list = itemsByBundle.get(it.bundle_id) ?? [];
    list.push(it);
    itemsByBundle.set(it.bundle_id, list);
  }
  const ownedByBundle = new Map(owned.rows.map(o => [o.bundle_id, o]));

  return Response.json({
    bundles: bundles.rows.map(b => {
      const o = ownedByBundle.get(b.id);
      const sold = Number(o?.sold ?? 0);
      return {
        id: b.id, name: b.name, slug: b.slug, type: b.bundle_type, description: b.description, status: b.status,
        basePrice: Number(b.base_price), discountedPrice: Number(b.discounted_price), currency: b.currency,
        expiryDays: b.expiry_days, isMixAndMatch: b.is_mix_and_match, isGiftable: b.is_giftable,
        isTransferable: b.is_transferable, seatsTotal: b.seats_total,
        items: (itemsByBundle.get(b.id) ?? []).map(i => ({
          id: i.id, type: i.item_type, name: i.name, quantity: i.quantity,
          productId: i.product_id ?? undefined, classCategory: i.class_category ?? undefined,
        })),
        sold, activeOwnerships: Number(o?.active ?? 0), revenue: Math.round(Number(b.discounted_price) * sold * 100) / 100,
        createdAt: b.created_at, updatedAt: b.updated_at,
      };
    }),
  });
}

interface CreateBundleBody {
  name?: string; slug?: string; type?: BundleType; description?: string;
  basePrice?: number; discountedPrice?: number; currency?: string; expiryDays?: number;
  isMixAndMatch?: boolean; isGiftable?: boolean; isTransferable?: boolean; seatsTotal?: number;
  items?: { type: BundleItemType; name: string; quantity: number; productId?: string; classCategory?: string }[];
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// POST /api/bundles — admin creates a bundle template. Starts "draft" — publish via
// PATCH .../bundles/[id] {action:'publish'} once items and pricing are confirmed.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as CreateBundleBody | null;
  if (!body?.name?.trim()) return Response.json({ error: 'Bundle name is required.' }, { status: 400 });
  if (!body.type) return Response.json({ error: 'Bundle type is required.' }, { status: 400 });
  if (!body.items?.length) return Response.json({ error: 'At least one item is required.' }, { status: 400 });
  if (typeof body.basePrice !== 'number' || body.basePrice < 0) return Response.json({ error: 'basePrice must be a non-negative number.' }, { status: 400 });

  const slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.name);
  const discountedPrice = body.discountedPrice ?? body.basePrice;

  try {
    // Reuse the real domain class for validation before ever touching the DB.
    new Bundle({
      id: '00000000-0000-0000-0000-000000000000', name: body.name.trim(), slug, type: body.type,
      description: body.description ?? '', status: 'draft',
      items: body.items.map((it, i) => ({ id: `pending-${i}`, type: it.type, name: it.name, quantity: it.quantity, usedCount: 0, productId: it.productId, classCategory: it.classCategory })),
      basePrice: body.basePrice, discountedPrice, currency: body.currency ?? 'CAD',
      expiryDays: body.expiryDays ?? 90, isMixAndMatch: body.isMixAndMatch ?? false,
      isGiftable: body.isGiftable ?? false, isTransferable: body.isTransferable ?? false,
      seatsTotal: body.seatsTotal, notes: '', createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid bundle data.' }, { status: 400 });
  }

  try {
    const id = await transaction(async (client) => {
      const bundleResult = await client.query<{ id: string }>(
        `INSERT INTO bundle_master
          (name, slug, bundle_type, description, status, base_price, discounted_price, currency,
           expiry_days, is_mix_and_match, is_giftable, is_transferable, seats_total, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          body.name!.trim(), slug, body.type, body.description ?? '', body.basePrice, discountedPrice,
          body.currency ?? 'CAD', body.expiryDays ?? 90, body.isMixAndMatch ?? false,
          body.isGiftable ?? false, body.isTransferable ?? false, body.seatsTotal ?? null, principal!.id,
        ],
      );
      const bundleId = bundleResult.rows[0].id;
      let sortOrder = 0;
      for (const it of body.items!) {
        await client.query(
          `INSERT INTO bundle_item (bundle_id, item_type, name, quantity, product_id, class_category, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [bundleId, it.type, it.name, it.quantity, it.productId ?? null, it.classCategory ?? null, sortOrder++],
        );
      }
      return bundleId;
    });
    return Response.json({ ok: true, id, status: 'draft' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A bundle with this slug already exists.' : message }, { status });
  }
}
