import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const dealRes = await client.query(`SELECT vehicle_id FROM auto_deal WHERE id = $1`, [params.id]);
      if (!dealRes.rows.length) return Response.json({ error: 'Deal not found' }, { status: 404 });
      const vehicle_id = dealRes.rows[0].vehicle_id;
      const [dealUpdate] = await Promise.all([
        client.query(`UPDATE auto_deal SET status = 'funded' WHERE id = $1 RETURNING *`, [params.id]),
        vehicle_id ? client.query(`UPDATE auto_vehicle_inventory SET status = 'sold' WHERE id = $1`, [vehicle_id]) : Promise.resolve(),
      ]);
      return Response.json(dealUpdate.rows[0]);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
