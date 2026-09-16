import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const [clientRow, campaigns, deliverables, reports] = await Promise.all([
      client.query(`SELECT * FROM dac_client WHERE id=$1`, [id]),
      client.query(`SELECT * FROM dac_campaign WHERE client_id=$1 ORDER BY created_at DESC`, [id]),
      client.query(`SELECT * FROM dac_deliverable WHERE client_id=$1 ORDER BY due_date`, [id]),
      client.query(`SELECT * FROM dac_report WHERE client_id=$1 ORDER BY report_month DESC`, [id]),
    ]);
    if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...clientRow.rows[0], campaigns: campaigns.rows, deliverables: deliverables.rows, reports: reports.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const fields = Object.keys(body).filter(k => ['churn_risk_score','nps_score','status','account_manager','notes','monthly_retainer','annual_value','contract_end'].includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(
      `UPDATE dac_client SET ${sets} WHERE id=$1 RETURNING *`,
      [id, ...fields.map(f => body[f])]
    );
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
