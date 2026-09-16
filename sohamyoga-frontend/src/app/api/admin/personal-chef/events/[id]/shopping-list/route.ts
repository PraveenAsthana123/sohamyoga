import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM chef_shopping_list WHERE event_id=$1 ORDER BY purchased, store, ingredient
      `, [params.id]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Support bulk add (array) or single item
      const items = Array.isArray(body) ? body : [body];
      const inserted = [];
      for (const item of items) {
        const { rows } = await client.query(`
          INSERT INTO chef_shopping_list (event_id, ingredient, quantity, unit, estimated_cost, store, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
        `, [
          params.id, item.ingredient, item.quantity || null,
          item.unit || null, item.estimated_cost || null,
          item.store || null, item.notes || null,
        ]);
        inserted.push(rows[0]);
      }
      return Response.json(inserted, { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Toggle purchased on an item: body = { item_id, purchased, actual_cost }
      const { rows } = await client.query(`
        UPDATE chef_shopping_list SET purchased=$2, actual_cost=$3
        WHERE id=$1 AND event_id=$4 RETURNING *
      `, [body.item_id, body.purchased, body.actual_cost || null, params.id]);
      if (!rows[0]) return Response.json({ error: 'Item not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
