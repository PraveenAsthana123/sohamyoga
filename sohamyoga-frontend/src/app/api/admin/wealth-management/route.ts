import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wm_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, date_of_birth DATE,
        province TEXT DEFAULT 'AB', marital_status TEXT
          CHECK (marital_status IN ('single','married','common_law','divorced','widowed')),
        dependents INTEGER DEFAULT 0, employment_status TEXT
          CHECK (employment_status IN ('employed','self_employed','retired','student','unemployed','disability')),
        employer TEXT, annual_income DECIMAL(12,2), spouse_income DECIMAL(12,2),
        client_type TEXT DEFAULT 'individual' CHECK (client_type IN ('individual','couple','family','business_owner')),
        financial_goals TEXT[], risk_tolerance TEXT DEFAULT 'moderate'
          CHECK (risk_tolerance IN ('conservative','moderate','aggressive')),
        current_planner TEXT, review_frequency TEXT DEFAULT 'annual'
          CHECK (review_frequency IN ('monthly','quarterly','semi_annual','annual')),
        last_review_date DATE, next_review_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','closed')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wm_financial_snapshot (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES wm_client(id),
        snapshot_date DATE DEFAULT CURRENT_DATE,
        cash_savings DECIMAL(12,2) DEFAULT 0, rrsp_balance DECIMAL(12,2) DEFAULT 0,
        tfsa_balance DECIMAL(12,2) DEFAULT 0, fhsa_balance DECIMAL(12,2) DEFAULT 0,
        resp_balance DECIMAL(12,2) DEFAULT 0, pension_value DECIMAL(12,2) DEFAULT 0,
        investment_non_reg DECIMAL(12,2) DEFAULT 0, real_estate_value DECIMAL(12,2) DEFAULT 0,
        other_assets DECIMAL(12,2) DEFAULT 0,
        mortgage_balance DECIMAL(12,2) DEFAULT 0, heloc_balance DECIMAL(12,2) DEFAULT 0,
        car_loan_balance DECIMAL(12,2) DEFAULT 0, student_loan_balance DECIMAL(12,2) DEFAULT 0,
        credit_card_balance DECIMAL(12,2) DEFAULT 0, other_debt DECIMAL(12,2) DEFAULT 0,
        monthly_income DECIMAL(10,2) DEFAULT 0, monthly_expenses DECIMAL(10,2) DEFAULT 0,
        monthly_savings DECIMAL(10,2) DEFAULT 0,
        net_worth DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wm_goal (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES wm_client(id),
        goal_name TEXT NOT NULL, goal_type TEXT NOT NULL
          CHECK (goal_type IN ('emergency_fund','home_purchase','retirement','education','debt_payoff','vacation','business','vehicle','other')),
        target_amount DECIMAL(12,2), current_amount DECIMAL(12,2) DEFAULT 0,
        target_date DATE, monthly_contribution DECIMAL(10,2),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_track','behind','completed','paused')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wm_insurance_review (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES wm_client(id),
        review_date DATE DEFAULT CURRENT_DATE,
        life_insurance_provider TEXT, life_coverage DECIMAL(12,2), life_premium DECIMAL(10,2),
        disability_provider TEXT, disability_benefit DECIMAL(10,2), disability_premium DECIMAL(10,2),
        critical_illness_provider TEXT, ci_coverage DECIMAL(12,2), ci_premium DECIMAL(10,2),
        health_dental_provider TEXT, health_dental_premium DECIMAL(10,2),
        home_insurance_provider TEXT, home_premium DECIMAL(10,2),
        auto_insurance_provider TEXT, auto_premium DECIMAL(10,2),
        gaps_identified TEXT[], recommendations TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [summary, reviewsDue, goalsBehind, snapshotStats] = await Promise.all([
        client.query(`SELECT COUNT(*) FILTER (WHERE status='active') AS active_clients, COUNT(*) AS total_clients FROM wm_client`),
        client.query(`SELECT COUNT(*) AS reviews_due_30d FROM wm_client WHERE next_review_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND status='active'`),
        client.query(`SELECT COUNT(*) AS goals_behind FROM wm_goal WHERE status='behind'`),
        client.query(`SELECT COALESCE(AVG(net_worth),0) AS net_worth_avg, COALESCE(SUM(net_worth),0) AS total_aum_snapshot FROM (SELECT DISTINCT ON (client_id) net_worth FROM wm_financial_snapshot ORDER BY client_id, snapshot_date DESC) latest`),
      ]);
      return NextResponse.json({
        active_clients: parseInt(summary.rows[0].active_clients),
        total_clients: parseInt(summary.rows[0].total_clients),
        reviews_due_30d: parseInt(reviewsDue.rows[0].reviews_due_30d),
        goals_behind_schedule: parseInt(goalsBehind.rows[0].goals_behind),
        total_aum_snapshot: parseFloat(snapshotStats.rows[0].total_aum_snapshot),
        net_worth_avg: parseFloat(snapshotStats.rows[0].net_worth_avg),
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
