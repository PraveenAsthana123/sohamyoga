import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Inventory Reservation -- src/domain/ecommerce/Inventory.ts already
// modeled reserve/release/commit business rules (available qty check,
// reserved-cannot-exceed-quantity invariants) and the real inventory/
// stock_movement tables matched it exactly, but NEITHER was ever wired to
// an API route -- confirmed via grep, only a read-only GET existed. This is
// the first real write path, applying the same invariants the domain class
// already encoded.
type Action = 'reserve' | 'release' | 'commit';
const ACTIONS: Action[] = ['reserve', 'release', 'commit'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { action?: Action; quantity?: number; referenceId?: string } | null;
  if (!body?.action || !ACTIONS.includes(body.action)) {
    return Response.json({ error: `action must be one of ${ACTIONS.join('|')}.` }, { status: 400 });
  }
  const qty = Number(body.quantity);
  if (!Number.isInteger(qty) || qty < 1) return Response.json({ error: 'quantity must be a positive integer.' }, { status: 400 });
  if (!body.referenceId?.trim()) return Response.json({ error: 'referenceId is required (e.g. the order id).' }, { status: 400 });

  const inv = await query<{ quantity: number; reserved_quantity: number; warehouse_id: string; allow_backorder: boolean }>(
    `SELECT quantity, reserved_quantity, warehouse_id, allow_backorder FROM inventory WHERE id = $1`, [id],
  );
  if (!inv.rowCount) return Response.json({ error: 'Inventory record not found.' }, { status: 404 });
  const row = inv.rows[0];
  const available = row.quantity - row.reserved_quantity;
  const performedBy = principal!.email ?? principal!.id;

  if (body.action === 'reserve') {
    // Real Backorder Management -- reserve() previously rejected any
    // request exceeding available stock outright. A SKU with
    // allow_backorder=true (explicit per-SKU opt-in, not a silent oversell)
    // may now reserve past available stock; reserved_quantity can exceed
    // quantity, and the response flags it so callers know fulfillment is
    // pending a restock rather than immediate.
    const backordered = qty > available;
    if (backordered && !row.allow_backorder) {
      return Response.json({ error: `Insufficient stock: ${available} available, ${qty} requested.` }, { status: 409 });
    }
    await query(`UPDATE inventory SET reserved_quantity = reserved_quantity + $2, updated_at = now() WHERE id = $1`, [id, qty]);
    await query(
      `INSERT INTO stock_movement (inventory_id, movement_type, quantity, reference_id, reason, warehouse_id, performed_by)
       VALUES ($1,'reservation',$2,$3,$4,$5,$6)`,
      [id, qty, body.referenceId.trim(), backordered ? 'backordered' : null, row.warehouse_id, performedBy],
    );
    return Response.json({ ok: true, backordered });
  } else if (body.action === 'release') {
    if (qty > row.reserved_quantity) return Response.json({ error: `Cannot release ${qty}: only ${row.reserved_quantity} reserved.` }, { status: 409 });
    await query(`UPDATE inventory SET reserved_quantity = reserved_quantity - $2, updated_at = now() WHERE id = $1`, [id, qty]);
    await query(
      `INSERT INTO stock_movement (inventory_id, movement_type, quantity, reference_id, warehouse_id, performed_by)
       VALUES ($1,'release',$2,$3,$4,$5)`,
      [id, qty, body.referenceId.trim(), row.warehouse_id, performedBy],
    );
  } else {
    if (qty > row.reserved_quantity) return Response.json({ error: `Cannot commit ${qty}: only ${row.reserved_quantity} reserved.` }, { status: 409 });
    if (qty > row.quantity) return Response.json({ error: `Cannot commit ${qty}: only ${row.quantity} in stock.` }, { status: 409 });
    await query(`UPDATE inventory SET quantity = quantity - $2, reserved_quantity = reserved_quantity - $2, updated_at = now() WHERE id = $1`, [id, qty]);
    await query(
      `INSERT INTO stock_movement (inventory_id, movement_type, quantity, reference_id, warehouse_id, performed_by)
       VALUES ($1,'sale',$2,$3,$4,$5)`,
      [id, -qty, body.referenceId.trim(), row.warehouse_id, performedBy],
    );
  }

  return Response.json({ ok: true });
}
