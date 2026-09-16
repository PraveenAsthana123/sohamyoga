import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const labour_hours = parseFloat(body.labour_hours ?? 0);
    const labour_rate = parseFloat(body.labour_rate ?? 145);
    const parts_cost = parseFloat(body.parts_cost ?? 0);
    const shop_supplies = parseFloat(body.shop_supplies ?? 0);
    const total_invoice = (labour_hours * labour_rate) + parts_cost + shop_supplies;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE auto_service_appointment
         SET status = 'completed', labour_hours = $2, labour_rate = $3,
             parts_cost = $4, shop_supplies = $5, total_invoice = $6, notes = COALESCE($7, notes)
         WHERE id = $1 RETURNING *`,
        [params.id, labour_hours, labour_rate, parts_cost, shop_supplies, total_invoice, body.notes]
      );
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
