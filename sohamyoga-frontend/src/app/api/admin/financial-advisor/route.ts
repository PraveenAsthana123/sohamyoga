import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVISION = `
CREATE TABLE IF NOT EXISTS fa_client (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT,
  date_of_birth DATE, province TEXT DEFAULT 'AB',
  employment_status TEXT, annual_income NUMERIC(12,2),
  net_worth NUMERIC(14,2), investable_assets NUMERIC(14,2),
  risk_tolerance TEXT DEFAULT 'moderate',
  investment_horizon TEXT,
  primary_goal TEXT,
  retirement_age_target INT,
  tax_bracket TEXT,
  rrsp_room NUMERIC(12,2), tfsa_room NUMERIC(10,2), fhsa_eligible BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'prospect',
  kyc_completed BOOLEAN DEFAULT false, kyc_date DATE,
  advisor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fa_account (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES fa_client(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  institution TEXT NOT NULL,
  account_number TEXT,
  current_value NUMERIC(14,2) DEFAULT 0,
  book_value NUMERIC(14,2) DEFAULT 0,
  unrealized_gain NUMERIC(12,2) GENERATED ALWAYS AS (current_value - book_value) STORED,
  annual_contribution NUMERIC(10,2),
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'active',
  opened_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fa_holding (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES fa_account(id) ON DELETE CASCADE,
  ticker TEXT, fund_name TEXT NOT NULL,
  asset_class TEXT,
  geography TEXT,
  quantity NUMERIC(14,4), avg_cost NUMERIC(10,4), current_price NUMERIC(10,4),
  market_value NUMERIC(14,2), weight_pct NUMERIC(5,2),
  asset_type TEXT,
  provider TEXT,
  mer_pct NUMERIC(5,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fa_recommendation (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES fa_client(id),
  recommendation_type TEXT,
  description TEXT,
  products JSONB DEFAULT '[]',
  estimated_impact TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION);

    const [aumRow, clientsRow, accountsRow, contribRow, riskRow] = await Promise.all([
      client.query(`
        SELECT
          COALESCE(SUM(current_value), 0) AS total_aum,
          COUNT(DISTINCT client_id) AS client_count,
          COALESCE(AVG(current_value), 0) AS avg_account_value
        FROM fa_account WHERE status = 'active'
      `),
      client.query(`SELECT COUNT(*) AS total FROM fa_client`),
      client.query(`
        SELECT account_type, COUNT(*) AS count, COALESCE(SUM(current_value), 0) AS total_value
        FROM fa_account WHERE status = 'active'
        GROUP BY account_type ORDER BY total_value DESC
      `),
      client.query(`
        SELECT COALESCE(SUM(annual_contribution), 0) AS annual_contributions
        FROM fa_account WHERE status = 'active'
      `),
      client.query(`
        SELECT risk_tolerance, COUNT(*) AS count
        FROM fa_client GROUP BY risk_tolerance ORDER BY count DESC
      `),
    ]);

    return Response.json({
      aum: aumRow.rows[0],
      clients: clientsRow.rows[0],
      accounts_by_type: accountsRow.rows,
      contributions: contribRow.rows[0],
      risk_distribution: riskRow.rows,
    });
  } finally {
    client.release();
  }
}
