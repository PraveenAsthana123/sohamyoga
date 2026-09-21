import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await req.json();

    const presc = await client.query(`SELECT * FROM rx_prescription WHERE id = $1 FOR UPDATE`, [params.id]);
    if (!presc.rows[0]) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }
    const rx = presc.rows[0];
    if (rx.status === 'dispensed') { await client.query('ROLLBACK'); return Response.json({ error: 'Already dispensed' }, { status: 400 }); }

    // Reduce inventory if DIN provided
    if (rx.din) {
      await client.query(
        `UPDATE rx_inventory SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1) WHERE din = $2`,
        [rx.quantity, rx.din]
      );
    }

    const newRefills = Math.max(0, (rx.refills_remaining ?? 0) - 1);
    const updated = await client.query(
      `UPDATE rx_prescription SET status='dispensed', dispensed_at=NOW(), dispensed_by=$1, refills_remaining=$2 WHERE id=$3 RETURNING *`,
      [b.dispensed_by ?? 'Pharmacist', newRefills, params.id]
    );

    await client.query('COMMIT');
    return Response.json(updated.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(e) }, { status: 500 });
  } finally { client.release(); }
}
