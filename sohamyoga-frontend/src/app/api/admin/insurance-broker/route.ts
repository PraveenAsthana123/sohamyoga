import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVISION = `
CREATE TABLE IF NOT EXISTS insurance_client (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT,
  address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
  date_of_birth DATE, gender TEXT, occupation TEXT, smoker BOOLEAN DEFAULT false,
  annual_income NUMERIC(12,2), credit_tier TEXT,
  status TEXT DEFAULT 'prospect',
  source TEXT,
  broker_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS insurance_policy (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES insurance_client(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  coverage_amount NUMERIC(12,2),
  annual_premium NUMERIC(10,2),
  monthly_premium NUMERIC(10,2),
  deductible NUMERIC(8,2),
  effective_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'quoted',
  coverage_details JSONB DEFAULT '{}',
  broker_commission_pct NUMERIC(5,2),
  broker_commission_amt NUMERIC(10,2),
  renewal_reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS insurance_quote (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES insurance_client(id),
  policy_type TEXT NOT NULL,
  insurer TEXT NOT NULL,
  quoted_premium NUMERIC(10,2),
  coverage_amount NUMERIC(12,2),
  deductible NUMERIC(8,2),
  quote_details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS insurance_claim (
  id SERIAL PRIMARY KEY,
  policy_id INT REFERENCES insurance_policy(id),
  claim_number TEXT,
  claim_type TEXT,
  incident_date DATE,
  filed_date DATE DEFAULT CURRENT_DATE,
  claim_amount NUMERIC(10,2),
  approved_amount NUMERIC(10,2),
  status TEXT DEFAULT 'filed',
  notes TEXT,
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

    const [clients, policies, quotes, claims, byType] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status != 'cancelled') AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'prospect') AS prospects
        FROM insurance_client
      `),
      client.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'active' AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS expiring_30d,
          COUNT(*) FILTER (WHERE status = 'active' AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60) AS expiring_60d
        FROM insurance_policy
      `),
      client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'accepted' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS accepted_this_month
        FROM insurance_quote
      `),
      client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN p.status = 'active' THEN COALESCE(p.broker_commission_amt, p.annual_premium * p.broker_commission_pct / 100 / 12) ELSE 0 END), 0) AS monthly,
          COALESCE(SUM(CASE WHEN p.status = 'active' THEN COALESCE(p.broker_commission_amt, p.annual_premium * p.broker_commission_pct / 100) ELSE 0 END), 0) AS annual,
          json_agg(json_build_object('policy_type', p.policy_type, 'commission',
            COALESCE(p.broker_commission_amt, p.annual_premium * p.broker_commission_pct / 100, 0))
          ) AS by_type_raw
        FROM insurance_policy p WHERE p.status = 'active'
      `),
      client.query(`
        SELECT policy_type,
          COUNT(*) AS count,
          COALESCE(SUM(annual_premium), 0) AS premium_volume
        FROM insurance_policy
        GROUP BY policy_type
        ORDER BY premium_volume DESC
      `),
    ]);

    const commRow = claims.rows[0] ?? {};
    const byTypeComm: Record<string, number> = {};
    if (Array.isArray(commRow.by_type_raw)) {
      for (const r of commRow.by_type_raw) {
        byTypeComm[r.policy_type] = (byTypeComm[r.policy_type] ?? 0) + Number(r.commission ?? 0);
      }
    }

    return Response.json({
      clients: clients.rows[0],
      policies: policies.rows[0],
      quotes: quotes.rows[0],
      commission: {
        monthly: Number(commRow.monthly ?? 0),
        annual: Number(commRow.annual ?? 0),
        by_type: Object.entries(byTypeComm).map(([k, v]) => ({ policy_type: k, commission: v })),
      },
      by_type: byType.rows,
    });
  } finally {
    client.release();
  }
}
