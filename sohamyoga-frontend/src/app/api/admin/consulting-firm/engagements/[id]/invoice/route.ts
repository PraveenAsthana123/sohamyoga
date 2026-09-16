import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Calculate billable unbilled hours
    const { rows: unbilledRows } = await client.query(
      `SELECT COALESCE(SUM(hours * hourly_rate),0) AS value, COUNT(*) AS count
       FROM cf_time_entry WHERE engagement_id=$1 AND billable=true AND billed=false`,
      [params.id]
    );
    const billableValue = parseFloat(unbilledRows[0].value);
    if (billableValue === 0) return Response.json({ error: 'No unbilled time entries' }, { status: 400 });

    // Mark time entries as billed
    await client.query(`UPDATE cf_time_entry SET billed=true WHERE engagement_id=$1 AND billable=true AND billed=false`, [params.id]);
    // Update billed_to_date on engagement
    const { rows } = await client.query(
      `UPDATE cf_engagement SET billed_to_date = billed_to_date + $1 WHERE id=$2 RETURNING *`,
      [billableValue, params.id]
    );
    return Response.json({
      invoice_amount: billableValue,
      time_entries_billed: parseInt(unbilledRows[0].count),
      engagement: rows[0],
    });
  } finally {
    client.release();
  }
}
