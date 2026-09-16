import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [aumRow, clientsRow, accountsRow, riskRow, recommendationsRow] = await Promise.all([
      client.query(`
        SELECT
          COALESCE(SUM(current_value), 0) AS total_aum,
          COALESCE(AVG(current_value), 0) AS avg_account_value,
          COUNT(*) AS total_accounts,
          COUNT(DISTINCT client_id) AS clients_with_accounts
        FROM fa_account WHERE status = 'active'
      `),
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE kyc_completed = true) AS kyc_done,
          COALESCE(AVG(investable_assets), 0) AS avg_investable_assets
        FROM fa_client
      `),
      client.query(`
        SELECT account_type, COUNT(*) AS count, COALESCE(SUM(current_value), 0) AS total_value
        FROM fa_account WHERE status = 'active'
        GROUP BY account_type ORDER BY total_value DESC
      `),
      client.query(`
        SELECT risk_tolerance, COUNT(*) AS count
        FROM fa_client GROUP BY risk_tolerance ORDER BY count DESC
      `),
      client.query(`
        SELECT status, COUNT(*) AS count
        FROM fa_recommendation GROUP BY status
      `),
    ]);

    return Response.json({
      aum: aumRow.rows[0],
      clients: clientsRow.rows[0],
      accounts_by_type: accountsRow.rows,
      risk_distribution: riskRow.rows,
      recommendations: recommendationsRow.rows,
    });
  } finally {
    client.release();
  }
}
