import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { Bundle, type BundleItem, type BundleStatus, type BundleType } from '@/domain/pricing/Bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BundleRow {
  id: string; name: string; slug: string; bundle_type: BundleType; description: string; status: BundleStatus;
  base_price: string; discounted_price: string; currency: string; expiry_days: number;
  is_mix_and_match: boolean; is_giftable: boolean; is_transferable: boolean;
  seats_total: number | null; created_by: string; created_at: Date; updated_at: Date;
}

async function loadTemplate(id: string): Promise<{ bundle: Bundle; row: BundleRow } | null> {
  const [rows, items] = await Promise.all([
    query<BundleRow>(`SELECT * FROM bundle_master WHERE id = $1`, [id]),
    query<{ id: string; item_type: string; name: string; quantity: number; product_id: string | null; class_category: string | null }>(
      `SELECT id, item_type, name, quantity, product_id, class_category FROM bundle_item WHERE bundle_id = $1`, [id],
    ),
  ]);
  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  const bundleItems: BundleItem[] = items.rows.map(i => ({
    id: i.id, type: i.item_type as BundleItem['type'], name: i.name, quantity: i.quantity, usedCount: 0,
    productId: i.product_id ?? undefined, classCategory: i.class_category ?? undefined,
  }));
  const bundle = new Bundle({
    id: r.id, name: r.name, slug: r.slug, type: r.bundle_type, description: r.description ?? '', status: r.status,
    items: bundleItems, basePrice: Number(r.base_price), discountedPrice: Number(r.discounted_price), currency: r.currency,
    expiryDays: r.expiry_days, isMixAndMatch: r.is_mix_and_match, isGiftable: r.is_giftable, isTransferable: r.is_transferable,
    seatsTotal: r.seats_total ?? undefined, notes: '', createdBy: r.created_by, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
  return { bundle, row: r };
}

type Action =
  | { action: 'publish' }
  | { action: 'suspend'; reason: string }
  | { action: 'reinstate' }
  | { action: 'archive' }
  | { action: 'purchase'; customerId: string }
  | { action: 'useItem'; ownershipId: string; itemId: string; count?: number };

// PATCH /api/bundles/[id]
// - Catalog-level (publish/suspend/reinstate/archive) transitions bundle_master.status.
//   "publish" (draft->active) has no equivalent on the Bundle class — Bundle.activate()
//   is scoped to a *customer's purchase*, not the template — so it's a direct, guarded
//   status write; every other transition reuses the real Bundle class methods.
// - "purchase" creates a real bundle_ownership row via Bundle.activate(customerId), plus
//   one bundle_usage row per item (credits start at 0 used).
// - "useItem" consumes real credits via Bundle.useItem(), persisted back to bundle_usage.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Action | null;
  if (!body?.action) {
    return Response.json({ error: 'action is required (publish|suspend|reinstate|archive|purchase|useItem).' }, { status: 400 });
  }

  const loaded = await loadTemplate(params.id);
  if (!loaded) return Response.json({ error: 'Bundle not found.' }, { status: 404 });
  const { bundle } = loaded;

  if (body.action === 'publish') {
    if (bundle.status !== 'draft') return Response.json({ error: 'Only draft bundles can be published.' }, { status: 409 });
    await query(`UPDATE bundle_master SET status = 'active', updated_at = now() WHERE id = $1`, [bundle.id]);
    return Response.json({ ok: true, status: 'active' });
  }

  if (body.action === 'suspend' || body.action === 'reinstate' || body.action === 'archive') {
    let next: Bundle;
    try {
      next = body.action === 'suspend' ? bundle.suspend(body.reason) : body.action === 'reinstate' ? bundle.reinstate() : bundle.archive();
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
    }
    await query(`UPDATE bundle_master SET status = $2, updated_at = now() WHERE id = $1`, [bundle.id, next.status]);
    return Response.json({ ok: true, status: next.status });
  }

  if (body.action === 'purchase') {
    if (bundle.status !== 'active') return Response.json({ error: 'Bundle must be active before it can be purchased.' }, { status: 403 });
    if (!body.customerId?.trim()) return Response.json({ error: 'customerId is required.' }, { status: 400 });

    let activated: Bundle;
    try {
      activated = bundle.activate(body.customerId);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Invalid activation.' }, { status: 409 });
    }
    const j = activated.toJSON();

    const ownershipId = await transaction(async (client) => {
      const owned = await client.query<{ id: string }>(
        `INSERT INTO bundle_ownership (bundle_id, customer_id, status, activated_at, expires_at)
         VALUES ($1,$2,'active',$3,$4) RETURNING id`,
        [bundle.id, body.customerId, j.activatedAt, j.expiresAt],
      );
      const oid = owned.rows[0].id;
      for (const item of j.items) {
        await client.query(
          `INSERT INTO bundle_usage (ownership_id, item_id, used_count) VALUES ($1,$2,0)`,
          [oid, item.id],
        );
      }
      return oid;
    });

    return Response.json({ ok: true, ownershipId, expiresAt: j.expiresAt, items: j.items }, { status: 201 });
  }

  if (body.action === 'useItem') {
    if (!body.ownershipId || !body.itemId) return Response.json({ error: 'ownershipId and itemId are required.' }, { status: 400 });

    const [ownRow, usageRows] = await Promise.all([
      query<{ customer_id: string; status: string; activated_at: Date; expires_at: Date }>(
        `SELECT customer_id, status, activated_at, expires_at FROM bundle_ownership WHERE id = $1 AND bundle_id = $2`,
        [body.ownershipId, bundle.id],
      ),
      query<{ item_id: string; used_count: number }>(
        `SELECT item_id, used_count FROM bundle_usage WHERE ownership_id = $1`, [body.ownershipId],
      ),
    ]);
    if (!ownRow.rows.length) return Response.json({ error: 'Ownership record not found for this bundle.' }, { status: 404 });
    const own = ownRow.rows[0];
    if (own.status !== 'active') return Response.json({ error: `Ownership is ${own.status}, not active.` }, { status: 409 });

    const usedByItem = new Map(usageRows.rows.map(u => [u.item_id, u.used_count]));
    const owned = new Bundle({
      ...bundle.toJSON(),
      status: 'active',
      items: bundle.items.map(i => ({ ...i, usedCount: usedByItem.get(i.id) ?? 0 })),
      customerId: own.customer_id, activatedAt: new Date(own.activated_at), expiresAt: new Date(own.expires_at),
    });

    let consumed: Bundle;
    try {
      consumed = owned.useItem(body.itemId, body.count ?? 1);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Could not consume credit.' }, { status: 409 });
    }
    const updatedItem = consumed.items.find(i => i.id === body.itemId)!;
    await query(
      `UPDATE bundle_usage SET used_count = $3, last_used_at = now() WHERE ownership_id = $1 AND item_id = $2`,
      [body.ownershipId, body.itemId, updatedItem.usedCount],
    );

    return Response.json({ ok: true, itemId: body.itemId, usedCount: updatedItem.usedCount, remaining: updatedItem.quantity - updatedItem.usedCount });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
