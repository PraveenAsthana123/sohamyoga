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
    id: string; product_name: string; sku: string; warehouse_name: string;
    quantity: number; reserved_quantity: number; reorder_point: number; batch_number: string | null; allow_backorder: boolean;
  }>(
    `SELECT i.id, p.name AS product_name, i.sku, w.name AS warehouse_name,
            i.quantity, i.reserved_quantity, i.reorder_point, i.batch_number, i.allow_backorder
     FROM inventory i
     JOIN product_master p ON p.id = i.product_id
     JOIN warehouse w ON w.id = i.warehouse_id
     ORDER BY i.updated_at DESC`,
  );

  const warehouses = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM warehouse WHERE is_active = true`);

  return Response.json({
    activeWarehouses: Number(warehouses.rows[0]?.count ?? 0),
    inventory: rows.rows.map(i => ({
      id: i.id, product: i.product_name, sku: i.sku, warehouse: i.warehouse_name,
      qty: i.quantity, reserved: i.reserved_quantity, reorderPoint: i.reorder_point,
      batch: i.batch_number ?? undefined, allowBackorder: i.allow_backorder,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { id?: string; allowBackorder?: boolean } | null;
  if (!body?.id || typeof body.allowBackorder !== 'boolean') {
    return Response.json({ error: 'id and allowBackorder (boolean) are required.' }, { status: 400 });
  }
  const result = await query(`UPDATE inventory SET allow_backorder = $2, updated_at = now() WHERE id = $1`, [body.id, body.allowBackorder]);
  if (!result.rowCount) return Response.json({ error: 'Inventory record not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
