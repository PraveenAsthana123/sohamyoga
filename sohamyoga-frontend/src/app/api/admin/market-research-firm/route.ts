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
      CREATE TABLE IF NOT EXISTS mr_client (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, industry TEXT,
        contact_name TEXT NOT NULL, contact_email TEXT NOT NULL, contact_phone TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        research_budget_annual DECIMAL(12,2), preferred_methodology TEXT[],
        status TEXT DEFAULT 'active' CHECK (status IN ('active','prospect','inactive')),
        total_projects INTEGER DEFAULT 0, total_fees DECIMAL(12,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mr_project (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES mr_client(id),
        project_name TEXT NOT NULL, project_number TEXT UNIQUE NOT NULL,
        research_type TEXT NOT NULL CHECK (research_type IN ('quantitative','qualitative','mixed_methods','competitive_intelligence','customer_satisfaction','brand_tracking','concept_testing','usability','focus_group','ethnography','desk_research')),
        methodology TEXT[],
        sample_size_target INTEGER, sample_size_actual INTEGER DEFAULT 0,
        target_audience TEXT, geographic_scope TEXT DEFAULT 'Calgary'
          CHECK (geographic_scope IN ('Calgary','Alberta','Western_Canada','Canada','North_America','Global')),
        status TEXT DEFAULT 'scoping'
          CHECK (status IN ('scoping','proposal_sent','approved','fieldwork','analysis','reporting','delivered','archived')),
        lead_researcher TEXT, project_fee DECIMAL(12,2), billed_to_date DECIMAL(12,2) DEFAULT 0,
        start_date DATE, fieldwork_start DATE, fieldwork_end DATE, delivery_date DATE,
        research_questions TEXT[], key_hypotheses TEXT[], deliverables TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mr_data_collection (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES mr_project(id) ON DELETE CASCADE,
        collection_method TEXT NOT NULL CHECK (collection_method IN ('online_survey','phone_interview','in_person_interview','focus_group','observation','mystery_shopping','secondary_source')),
        status TEXT DEFAULT 'planned' CHECK (status IN ('planned','active','paused','completed')),
        target_completes INTEGER, actual_completes INTEGER DEFAULT 0,
        response_rate DECIMAL(5,2), quality_issues TEXT,
        collection_start DATE, collection_end DATE, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mr_finding (
        id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES mr_project(id) ON DELETE CASCADE,
        finding_type TEXT NOT NULL CHECK (finding_type IN ('key_finding','insight','recommendation','data_point','quote','anomaly')),
        finding_title TEXT NOT NULL, finding_description TEXT NOT NULL,
        supporting_data TEXT, confidence_level TEXT DEFAULT 'high'
          CHECK (confidence_level IN ('high','medium','low','exploratory')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
        category TEXT, tags TEXT[],
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
    const [activeProj, fieldwork, deliveries, revenueRow, completionRow] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM mr_project WHERE status NOT IN ('delivered','archived')`),
      client.query(`SELECT COUNT(*) AS n FROM mr_project WHERE status='fieldwork'`),
      client.query(`SELECT COUNT(*) AS n FROM mr_project WHERE delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`),
      client.query(`SELECT COALESCE(SUM(project_fee),0) AS rev FROM mr_project WHERE EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM NOW())`),
      client.query(`SELECT ROUND(AVG(CASE WHEN sample_size_target>0 THEN (sample_size_actual::DECIMAL/sample_size_target)*100 ELSE NULL END),1) AS avg_completion FROM mr_project WHERE status IN ('fieldwork','analysis')`),
    ]);
    return Response.json({
      active_projects: parseInt(activeProj.rows[0].n),
      fieldwork_in_progress: parseInt(fieldwork.rows[0].n),
      deliveries_this_month: parseInt(deliveries.rows[0].n),
      total_revenue_ytd: parseFloat(revenueRow.rows[0].rev),
      sample_completion_rate: parseFloat(completionRow.rows[0].avg_completion) || 0,
    });
  } finally {
    client.release();
  }
}
