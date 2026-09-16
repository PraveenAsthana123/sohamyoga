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
      CREATE TABLE IF NOT EXISTS dac_client (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, industry TEXT,
        contact_name TEXT NOT NULL, contact_email TEXT NOT NULL, contact_phone TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        client_type TEXT DEFAULT 'retainer' CHECK (client_type IN ('retainer','project','one_time','enterprise')),
        monthly_retainer DECIMAL(10,2), annual_value DECIMAL(12,2),
        services TEXT[] DEFAULT ARRAY['seo'],
        account_manager TEXT, onboarding_date DATE DEFAULT CURRENT_DATE,
        contract_start DATE, contract_end DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','at_risk','churned','prospect','paused')),
        churn_risk_score INTEGER DEFAULT 0 CHECK (churn_risk_score BETWEEN 0 AND 100),
        nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dac_campaign (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES dac_client(id),
        campaign_name TEXT NOT NULL, campaign_type TEXT NOT NULL
          CHECK (campaign_type IN ('seo','google_ads','meta_ads','linkedin_ads','email','content','social_organic','video','pr','influencer','affiliate')),
        platform TEXT, objective TEXT,
        budget_monthly DECIMAL(10,2), spend_mtd DECIMAL(10,2) DEFAULT 0,
        start_date DATE, end_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('draft','active','paused','completed','cancelled')),
        impressions_mtd BIGINT DEFAULT 0, clicks_mtd INTEGER DEFAULT 0,
        conversions_mtd INTEGER DEFAULT 0, leads_mtd INTEGER DEFAULT 0,
        roas DECIMAL(8,2), cpc DECIMAL(8,2), ctr DECIMAL(5,2), cpa DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dac_deliverable (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES dac_client(id),
        campaign_id INTEGER REFERENCES dac_campaign(id),
        deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('blog_post','social_post','ad_creative','landing_page','email_template','report','video_script','keyword_research','audit','strategy_deck','other')),
        title TEXT NOT NULL, assigned_to TEXT, due_date DATE,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','approved','published','revision_required')),
        client_approved BOOLEAN DEFAULT false, published_url TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dac_report (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES dac_client(id),
        report_month TEXT NOT NULL,
        total_impressions BIGINT, total_clicks INTEGER, total_conversions INTEGER,
        total_spend DECIMAL(10,2), roas DECIMAL(8,2), top_performing_campaign TEXT,
        seo_keywords_top10 INTEGER, organic_traffic_growth_pct DECIMAL(6,2),
        social_followers_gained INTEGER, email_open_rate DECIMAL(5,2),
        report_url TEXT, sent_to_client BOOLEAN DEFAULT false, sent_date DATE,
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
    const [activeClients, mrrRow, campaigns, deliverables, atRisk] = await Promise.all([
      client.query(`SELECT COUNT(*) AS n FROM dac_client WHERE status='active'`),
      client.query(`SELECT COALESCE(SUM(monthly_retainer),0) AS mrr FROM dac_client WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM dac_campaign WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS n FROM dac_deliverable WHERE due_date <= CURRENT_DATE + INTERVAL '7 days' AND status NOT IN ('approved','published')`),
      client.query(`SELECT COUNT(*) AS n FROM dac_client WHERE status='at_risk'`),
    ]);
    return Response.json({
      active_clients: parseInt(activeClients.rows[0].n),
      mrr_total: parseFloat(mrrRow.rows[0].mrr),
      campaigns_active: parseInt(campaigns.rows[0].n),
      deliverables_due_this_week: parseInt(deliverables.rows[0].n),
      at_risk_clients: parseInt(atRisk.rows[0].n),
    });
  } finally {
    client.release();
  }
}
