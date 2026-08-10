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
    quantity: number; reserved_quantity: number; reorder_point: number; batch_number: string | null;
  }>(
    `SELECT i.id, p.name AS product_name, i.sku, w.name AS warehouse_name,
            i.quantity, i.reserved_quantity, i.reorder_point, i.batch_number
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
      batch: i.batch_number ?? undefined,
    })),
  });
}
