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
      CREATE TABLE IF NOT EXISTS sa_client_company (
        id SERIAL PRIMARY KEY, company_name TEXT NOT NULL, industry TEXT,
        contact_name TEXT NOT NULL, contact_title TEXT, contact_email TEXT NOT NULL, contact_phone TEXT,
        billing_address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        contract_type TEXT DEFAULT 'contingency'
          CHECK (contract_type IN ('contingency','retained','hybrid','temp_to_perm','staffing')),
        fee_structure TEXT, payment_terms TEXT DEFAULT 'net_30',
        active_job_orders INTEGER DEFAULT 0, total_placements INTEGER DEFAULT 0,
        total_fees_earned DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sa_job_order (
        id SERIAL PRIMARY KEY, client_company_id INTEGER REFERENCES sa_client_company(id),
        job_title TEXT NOT NULL, department TEXT, job_type TEXT DEFAULT 'permanent'
          CHECK (job_type IN ('permanent','contract','temp','temp_to_perm','executive')),
        salary_min DECIMAL(12,2), salary_max DECIMAL(12,2), salary_currency TEXT DEFAULT 'CAD',
        work_location TEXT DEFAULT 'hybrid' CHECK (work_location IN ('onsite','remote','hybrid')),
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        required_skills TEXT[], preferred_skills TEXT[], required_certifications TEXT[],
        years_experience_min INTEGER DEFAULT 0, education_requirement TEXT,
        job_description TEXT, priority TEXT DEFAULT 'medium'
          CHECK (priority IN ('low','medium','high','exclusive')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','filled','cancelled')),
        assigned_recruiter TEXT, target_start_date DATE,
        fee_amount DECIMAL(12,2), fee_collected BOOLEAN DEFAULT false,
        opened_date DATE DEFAULT CURRENT_DATE, filled_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sa_candidate (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, phone TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        current_title TEXT, current_employer TEXT, years_experience INTEGER DEFAULT 0,
        highest_education TEXT, desired_salary_min DECIMAL(12,2), desired_salary_max DECIMAL(12,2),
        work_authorization TEXT DEFAULT 'canadian_citizen'
          CHECK (work_authorization IN ('canadian_citizen','permanent_resident','work_permit','open_work_permit','student_visa','requires_sponsorship')),
        availability TEXT DEFAULT 'immediately'
          CHECK (availability IN ('immediately','2_weeks','1_month','2_months','negotiable')),
        skills TEXT[], certifications TEXT[], industries TEXT[],
        resume_url TEXT, linkedin_url TEXT, source TEXT
          CHECK (source IN ('job_board','linkedin','referral','direct','career_fair','university','other')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active','placed','not_available','do_not_contact')),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sa_submission (
        id SERIAL PRIMARY KEY, job_order_id INTEGER REFERENCES sa_job_order(id),
        candidate_id INTEGER REFERENCES sa_candidate(id),
        submitted_at TIMESTAMPTZ DEFAULT NOW(), submitted_by TEXT,
        status TEXT DEFAULT 'submitted'
          CHECK (status IN ('submitted','shortlisted','client_interview','second_interview','offer_extended','offer_accepted','offer_declined','not_selected','placed','withdrew')),
        client_feedback TEXT, interview_date TIMESTAMPTZ,
        offer_amount DECIMAL(12,2), offer_accepted_date DATE,
        start_date DATE, fee_invoiced DECIMAL(12,2), fee_collected BOOLEAN DEFAULT false,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
      const [orders, subs, placements, pipeline] = await Promise.all([
        client.query(`SELECT COUNT(*) FILTER (WHERE status='active') AS active_job_orders FROM sa_job_order`),
        client.query(`SELECT COUNT(*) AS submissions_this_month FROM sa_submission WHERE submitted_at >= date_trunc('month', NOW())`),
        client.query(`SELECT COUNT(*) AS placements_mtd FROM sa_submission WHERE status='placed' AND submitted_at >= date_trunc('month', NOW())`),
        client.query(`SELECT COALESCE(SUM(j.fee_amount),0) AS pipeline_fee_value FROM sa_submission s JOIN sa_job_order j ON j.id=s.job_order_id WHERE s.status NOT IN ('not_selected','withdrew','offer_declined')`),
      ]);
      const totalOrders = parseInt((await client.query(`SELECT COUNT(*) AS n FROM sa_job_order`)).rows[0].n);
      const filledOrders = parseInt((await client.query(`SELECT COUNT(*) AS n FROM sa_job_order WHERE status='filled'`)).rows[0].n);
      const fillRate = totalOrders > 0 ? Math.round(filledOrders/totalOrders*100) : 0;
      return NextResponse.json({
        active_job_orders: parseInt(orders.rows[0].active_job_orders),
        submissions_this_month: parseInt(subs.rows[0].submissions_this_month),
        placements_mtd: parseInt(placements.rows[0].placements_mtd),
        pipeline_fee_value: parseFloat(pipeline.rows[0].pipeline_fee_value),
        fill_rate_pct: fillRate,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
