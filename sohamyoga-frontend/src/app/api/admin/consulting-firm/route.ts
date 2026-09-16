import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cf_client (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, industry TEXT,
        contact_name TEXT NOT NULL, contact_title TEXT, contact_email TEXT NOT NULL, contact_phone TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        annual_revenue_estimate DECIMAL(14,2), employee_count INTEGER,
        engagement_type TEXT DEFAULT 'project' CHECK (engagement_type IN ('project','retainer','advisory','fractional_cxo','due_diligence','other')),
        relationship_manager TEXT, source TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','prospect','completed','on_hold')),
        total_fees DECIMAL(12,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cf_engagement (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES cf_client(id),
        engagement_name TEXT NOT NULL, engagement_number TEXT UNIQUE NOT NULL,
        engagement_type TEXT CHECK (engagement_type IN ('strategy','operations','finance','hr','technology','change_management','market_entry','m_and_a','restructuring','other')),
        lead_consultant TEXT, team_members TEXT[],
        start_date DATE, end_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('proposal','active','on_hold','completed','cancelled')),
        total_fee DECIMAL(12,2), billed_to_date DECIMAL(12,2) DEFAULT 0,
        contract_type TEXT DEFAULT 'fixed' CHECK (contract_type IN ('fixed','time_and_materials','retainer','success_fee')),
        hourly_rate DECIMAL(10,2), budgeted_hours DECIMAL(8,2), actual_hours DECIMAL(8,2) DEFAULT 0,
        description TEXT, deliverables TEXT[], key_outcomes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cf_time_entry (
        id SERIAL PRIMARY KEY, engagement_id INTEGER REFERENCES cf_engagement(id),
        consultant TEXT NOT NULL, entry_date DATE NOT NULL,
        hours DECIMAL(5,2) NOT NULL, activity TEXT NOT NULL,
        billable BOOLEAN DEFAULT true, billed BOOLEAN DEFAULT false,
        hourly_rate DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cf_deliverable (
        id SERIAL PRIMARY KEY, engagement_id INTEGER REFERENCES cf_engagement(id),
        deliverable_name TEXT NOT NULL,
        deliverable_type TEXT CHECK (deliverable_type IN ('strategy_report','financial_model','process_map','org_design','market_analysis','presentation','implementation_plan','other')),
        due_date DATE, submitted_date DATE, status TEXT DEFAULT 'in_progress'
          CHECK (status IN ('in_progress','submitted','client_review','accepted','revision_required')),
        assigned_to TEXT, version TEXT DEFAULT '1.0', notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [activeEng, wipRow, billedRow, utilRow, overdueRow] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM cf_engagement WHERE status='active'`),
      client.query(`SELECT COALESCE(SUM(total_fee - billed_to_date),0) AS wip FROM cf_engagement WHERE status='active'`),
      client.query(`SELECT COALESCE(SUM(billed_to_date),0) AS billed FROM cf_engagement WHERE EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM NOW())`),
      client.query(`SELECT COALESCE(SUM(actual_hours),0) AS actual, COALESCE(SUM(budgeted_hours),0) AS budget FROM cf_engagement WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM cf_deliverable WHERE due_date<CURRENT_DATE AND status NOT IN ('accepted')`),
    ]);
    const actual = parseFloat(utilRow.rows[0].actual);
    const budget = parseFloat(utilRow.rows[0].budget);
    return Response.json({
      active_engagements: parseInt(activeEng.rows[0].n),
      wip_value: parseFloat(wipRow.rows[0].wip),
      total_billed_ytd: parseFloat(billedRow.rows[0].billed),
      utilization_rate: budget > 0 ? Math.round((actual / budget) * 100) : 0,
      deliverables_overdue: parseInt(overdueRow.rows[0].n),
    });
  } finally {
    client.release();
  }
}
