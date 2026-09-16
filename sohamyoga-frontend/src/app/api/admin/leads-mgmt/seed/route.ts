import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead (
      id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(200),
      phone VARCHAR(50), company VARCHAR(200), job_title VARCHAR(100),
      lead_source VARCHAR(50) DEFAULT 'website', lead_stage VARCHAR(30) DEFAULT 'new',
      lead_score INT DEFAULT 0, assigned_to VARCHAR(100), notes TEXT, tags TEXT,
      utm_source VARCHAR(100), utm_medium VARCHAR(100), utm_campaign VARCHAR(100),
      last_contact_at TIMESTAMPTZ, expected_close_date DATE, deal_value DECIMAL(12,2),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lead_activity (
      id SERIAL PRIMARY KEY, lead_id INT REFERENCES lead(id) ON DELETE CASCADE,
      activity_type VARCHAR(30), description TEXT, outcome VARCHAR(100),
      created_by VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lead_form (
      id SERIAL PRIMARY KEY, form_name VARCHAR(200), fields JSONB DEFAULT '[]',
      embed_code TEXT, source_page VARCHAR(300), submissions INT DEFAULT 0,
      conversions INT DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 20 demo leads
  const leads = [
    ['Emma', 'Thompson', 'emma.t@gmail.com', '416-555-0101', 'Tech Corp', 'Product Manager', 'website', 'new', 45, 'Sarah M.', 2500],
    ['James', 'Wilson', 'jwilson@startup.io', '647-555-0102', 'Startup Labs', 'CEO', 'referral', 'qualified', 78, 'Mike R.', 8500],
    ['Priya', 'Patel', 'priya.p@consulting.ca', '416-555-0103', 'Deloitte', 'Senior Consultant', 'linkedin', 'contacted', 62, 'Sarah M.', 4200],
    ['Michael', 'Chen', 'mchen@finance.com', '905-555-0104', 'Bay Street Finance', 'VP Operations', 'event', 'proposal', 85, 'Mike R.', 12000],
    ['Sophie', 'Martin', 'smartin@media.com', '416-555-0105', 'Creative Media', 'Director', 'social', 'won', 92, 'Sarah M.', 15000],
    ['David', 'Kim', 'dkim@health.org', '647-555-0106', 'Health First', 'Wellness Manager', 'partner', 'negotiation', 88, 'Mike R.', 9800],
    ['Linda', 'Rodriguez', 'linda.r@edu.ca', '905-555-0107', 'University of Toronto', 'Prof', 'website', 'new', 35, 'Sarah M.', 1800],
    ['Robert', 'Anderson', 'r.anderson@law.ca', '416-555-0108', 'Anderson & Co Law', 'Partner', 'referral', 'qualified', 72, 'Mike R.', 6500],
    ['Aisha', 'Johnson', 'aisha.j@ngo.org', '647-555-0109', 'Wellness NGO', 'Executive Director', 'campaign', 'contacted', 58, 'Sarah M.', 3200],
    ['Tyler', 'Brown', 'tbrown@retail.com', '905-555-0110', 'Retail Chain', 'Store Manager', 'website', 'lost', 25, 'Mike R.', 1200],
    ['Maya', 'Gupta', 'maya.g@pharma.com', '416-555-0111', 'PharmaCo', 'HR Director', 'event', 'proposal', 81, 'Sarah M.', 11000],
    ['Nathan', 'Lee', 'nlee@tech.io', '647-555-0112', 'TechIO', 'CTO', 'referral', 'won', 95, 'Mike R.', 18000],
    ['Olivia', 'Clark', 'oclark@realty.ca', '905-555-0113', 'Clark Realty', 'Real Estate Agent', 'social', 'new', 42, 'Sarah M.', 2800],
    ['Samuel', 'Wright', 'swright@bank.ca', '416-555-0114', 'National Bank', 'Financial Advisor', 'cold_outreach', 'contacted', 55, 'Mike R.', 3500],
    ['Isabella', 'Young', 'iyoung@yoga.com', '647-555-0115', 'YogaLite Studios', 'Owner', 'partner', 'negotiation', 86, 'Sarah M.', 22000],
    ['Christopher', 'Hall', 'chall@gov.ca', '905-555-0116', 'City of Toronto', 'Program Manager', 'website', 'new', 38, 'Mike R.', 5500],
    ['Zoe', 'Allen', 'zallen@startup.ca', '416-555-0117', 'GreenTech', 'Co-Founder', 'event', 'qualified', 68, 'Sarah M.', 7200],
    ['Benjamin', 'Scott', 'bscott@consulting.ca', '647-555-0118', 'Scott Advisory', 'Principal', 'referral', 'proposal', 79, 'Mike R.', 9500],
    ['Charlotte', 'King', 'cking@hospital.ca', '905-555-0119', 'St. Michaels Hospital', 'Physiotherapist', 'social', 'contacted', 61, 'Sarah M.', 4000],
    ['Alexander', 'Mitchell', 'amitchell@corp.com', '416-555-0120', 'Mitchell Corp', 'COO', 'campaign', 'lost', 30, 'Mike R.', 1500],
  ];

  for (const l of leads) {
    await pool.query(
      `INSERT INTO lead (first_name, last_name, email, phone, company, job_title, lead_source,
       lead_stage, lead_score, assigned_to, deal_value, last_contact_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
         NOW() - (RANDOM()*30)::int * INTERVAL '1 day',
         NOW() - (RANDOM()*90)::int * INTERVAL '1 day')
       ON CONFLICT DO NOTHING`,
      [...l.slice(0, 11)],
    );
  }

  // Lead form
  await pool.query(`
    INSERT INTO lead_form (form_name, fields, embed_code, source_page, submissions, conversions) VALUES
    ('Main Contact Form', '[{"name":"first_name","type":"text","label":"First Name","required":true},{"name":"email","type":"email","label":"Email","required":true},{"name":"message","type":"textarea","label":"Message","required":false}]',
     '<iframe src="/forms/1" width="100%" height="500" frameborder="0"></iframe>',
     '/contact', 284, 47),
    ('Free Trial Signup', '[{"name":"name","type":"text","label":"Full Name","required":true},{"name":"email","type":"email","label":"Email","required":true},{"name":"phone","type":"phone","label":"Phone","required":false}]',
     '<iframe src="/forms/2" width="100%" height="500" frameborder="0"></iframe>',
     '/free-trial', 156, 89)
    ON CONFLICT DO NOTHING;
  `);

  return Response.json({ seeded: true });
}
