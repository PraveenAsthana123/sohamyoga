import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVISION = `
CREATE TABLE IF NOT EXISTS mortgage_client (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT,
  address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
  date_of_birth DATE, sin_last4 TEXT,
  employment_type TEXT,
  annual_income NUMERIC(12,2), co_applicant_income NUMERIC(12,2),
  credit_score INT, credit_tier TEXT,
  total_debt NUMERIC(12,2), monthly_obligations NUMERIC(10,2),
  status TEXT DEFAULT 'prospect',
  source TEXT,
  broker_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mortgage_application (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES mortgage_client(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL,
  property_type TEXT,
  property_address TEXT, property_city TEXT DEFAULT 'Calgary', property_province TEXT DEFAULT 'AB',
  purchase_price NUMERIC(12,2), appraised_value NUMERIC(12,2),
  down_payment NUMERIC(12,2), down_payment_pct NUMERIC(5,2),
  mortgage_amount NUMERIC(12,2),
  cmhc_insured BOOLEAN DEFAULT false, cmhc_premium NUMERIC(10,2),
  requested_rate NUMERIC(6,4), rate_type TEXT DEFAULT 'fixed',
  amortization_years INT DEFAULT 25,
  term_years INT DEFAULT 5,
  payment_frequency TEXT DEFAULT 'monthly',
  lender TEXT, lender_rate NUMERIC(6,4),
  status TEXT DEFAULT 'draft',
  conditions TEXT[],
  closing_date DATE,
  funded_date DATE,
  broker_fee NUMERIC(10,2), finder_fee_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mortgage_lender_submission (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES mortgage_application(id) ON DELETE CASCADE,
  lender TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  rate_offered NUMERIC(6,4),
  conditions TEXT[],
  status TEXT DEFAULT 'pending',
  decision_date TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(application_id, lender)
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION);

    const [clientStats, appStats, rateRow, lenderRow] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status NOT IN ('closed','declined')) AS active,
          COUNT(*) FILTER (WHERE status = 'pre_approved') AS pre_approved
        FROM mortgage_client
      `),
      client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft') AS draft,
          COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
          COUNT(*) FILTER (WHERE status IN ('conditionally_approved','approved')) AS approved,
          COUNT(*) FILTER (WHERE status = 'funded') AS funded,
          COALESCE(SUM(mortgage_amount) FILTER (WHERE status NOT IN ('cancelled','declined')), 0) AS pipeline_value,
          COALESCE(SUM(mortgage_amount) FILTER (WHERE status = 'funded' AND funded_date >= date_trunc('month', NOW())), 0) AS funded_this_month
        FROM mortgage_application
      `),
      client.query(`SELECT ROUND(AVG(lender_rate)::NUMERIC, 4) AS avg_rate FROM mortgage_application WHERE lender_rate IS NOT NULL`),
      client.query(`
        SELECT lender, COUNT(*) AS count
        FROM mortgage_application
        WHERE lender IS NOT NULL AND status IN ('approved','funded')
        GROUP BY lender ORDER BY count DESC LIMIT 5
      `),
    ]);

    return Response.json({
      clients: clientStats.rows[0],
      applications: appStats.rows[0],
      avg_rate: rateRow.rows[0]?.avg_rate ?? null,
      top_lenders: lenderRow.rows,
    });
  } finally {
    client.release();
  }
}
