import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const room = searchParams.get('room');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions = [`project_id = $1`];
      const vals: unknown[] = [params.id];
      if (room) { conditions.push(`room ILIKE $${vals.length + 1}`); vals.push(room); }
      if (status) { conditions.push(`status = $${vals.length + 1}`); vals.push(status); }
      if (category) { conditions.push(`category = $${vals.length + 1}`); vals.push(category); }
      const { rows } = await client.query(`SELECT * FROM id_item WHERE ${conditions.join(' AND ')} ORDER BY room, category`, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    // Auto-calculate unit_retail = unit_cost × (1 + designer_markup_pct/100)
    const markup = body.designer_markup_pct ?? 30;
    const unit_retail = body.unit_retail ?? (body.unit_cost ? body.unit_cost * (1 + markup / 100) : null);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO id_item (project_id, room, item_name, category, supplier, model_sku, finish, dimensions, quantity, unit_cost, unit_retail, designer_markup_pct, status, lead_time_weeks, order_date, expected_delivery, notes, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [params.id, body.room, body.item_name, body.category, body.supplier, body.model_sku,
         body.finish, body.dimensions, body.quantity ?? 1, body.unit_cost, unit_retail, markup,
         body.status ?? 'specified', body.lead_time_weeks, body.order_date, body.expected_delivery,
         body.notes, body.image_url]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
