import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clientRow, accounts, recommendations] = await Promise.all([
      client.query(`SELECT * FROM fa_client WHERE id = $1`, [id]),
      client.query(`
        SELECT a.*,
          json_agg(h ORDER BY h.market_value DESC NULLS LAST) FILTER (WHERE h.id IS NOT NULL) AS holdings
        FROM fa_account a
        LEFT JOIN fa_holding h ON h.account_id = a.id
        WHERE a.client_id = $1
        GROUP BY a.id
        ORDER BY a.current_value DESC
      `, [id]),
      client.query(`
        SELECT * FROM fa_recommendation WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20
      `, [id]),
    ]);
    if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({
      client: clientRow.rows[0],
      accounts: accounts.rows,
      recommendations: recommendations.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const allowed = ['name','email','phone','date_of_birth','province','employment_status','annual_income',
    'net_worth','investable_assets','risk_tolerance','investment_horizon','primary_goal',
    'retirement_age_target','tax_bracket','rrsp_room','tfsa_room','fhsa_eligible',
    'status','kyc_completed','kyc_date','advisor_notes'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in b) { sets.push(`${key} = $${idx++}`); vals.push(b[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  vals.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE fa_client SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ client: result.rows[0] });
  } finally {
    client.release();
  }
}
