import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { odometer_out, total_amount, payment_method, customer_rating } = body;
  if (!payment_method) return Response.json({ error: 'payment_method required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: woRows } = await client.query(`SELECT * FROM ar_work_order WHERE id=$1 FOR UPDATE`, [params.id]);
    if (!woRows.length) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }
    const wo = woRows[0];
    const finalTotal = total_amount ?? wo.total_amount;
    // Update work order to completed
    await client.query(`
      UPDATE ar_work_order SET status='completed', payment_status='paid', payment_method=$1,
        odometer_out=$2, total_amount=$3, customer_rating=$4
      WHERE id=$5
    `, [payment_method, odometer_out||wo.odometer_in, finalTotal, customer_rating||null, params.id]);
    // Update customer totals
    await client.query(`
      UPDATE ar_customer SET total_visits=total_visits+1, total_spent=total_spent+$1 WHERE id=$2
    `, [finalTotal, wo.customer_id]);
    // Update vehicle
    if (wo.vehicle_id) {
      const updates: [string, unknown][] = [["last_service_date=$1", new Date().toISOString().slice(0,10)]];
      if (odometer_out) updates.push(["odometer_km=$2", odometer_out]);
      if (updates.length === 1) {
        await client.query(`UPDATE ar_vehicle SET last_service_date=$1 WHERE id=$2`, [updates[0][1], wo.vehicle_id]);
      } else {
        await client.query(`UPDATE ar_vehicle SET last_service_date=$1, odometer_km=$2 WHERE id=$3`, [updates[0][1], odometer_out, wo.vehicle_id]);
      }
    }
    await client.query('COMMIT');
    const { rows } = await client.query(`SELECT * FROM ar_work_order WHERE id=$1`, [params.id]);
    return Response.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
