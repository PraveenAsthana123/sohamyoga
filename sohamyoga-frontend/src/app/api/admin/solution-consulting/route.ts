export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision() {
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS consulting_opportunities (
      id SERIAL PRIMARY KEY, client_name TEXT, contact TEXT, description TEXT,
      stage TEXT DEFAULT 'discovery', value NUMERIC DEFAULT 0,
      win_probability INTEGER DEFAULT 50, requirements JSONB,
      solution_design TEXT, demo_date DATE, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS consulting_deliveries (
      id SERIAL PRIMARY KEY, opportunity_id INTEGER, name TEXT,
      status TEXT DEFAULT 'planning', milestones JSONB, team_members TEXT[],
      start_date DATE, end_date DATE, health TEXT DEFAULT 'green',
      created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS consulting_upsell_playbooks (
      id SERIAL PRIMARY KEY, trigger_event TEXT, offer TEXT, script TEXT,
      success_rate NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);

    const { rows } = await client.query('SELECT COUNT(*) AS cnt FROM consulting_opportunities');
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`INSERT INTO consulting_opportunities (client_name,contact,description,stage,value,win_probability,requirements,solution_design) VALUES
        ('Apex Technologies','Sarah Chen, CTO','End-to-end marketing automation platform implementation with CRM integration','proposal',85000,75,'[{"id":1,"title":"CRM Integration","priority":"high","status":"confirmed"},{"id":2,"title":"Email Automation","priority":"high","status":"confirmed"},{"id":3,"title":"Analytics Dashboard","priority":"medium","status":"pending"},{"id":4,"title":"SSO Integration","priority":"low","status":"tbd"}]','Phase 1: Audit & Setup (weeks 1-2). Phase 2: Core integrations (weeks 3-6). Phase 3: Analytics & dashboards (weeks 7-10). Phase 4: Training & handoff (weeks 11-12).'),
        ('GlobalRetail Group','Mark Johnson, VP Digital','Omnichannel marketing suite for 50+ retail locations','discovery',120000,45,'[{"id":1,"title":"POS Integration","priority":"high","status":"pending"},{"id":2,"title":"Loyalty Program","priority":"high","status":"confirmed"},{"id":3,"title":"Mobile App","priority":"medium","status":"tbd"}]',NULL),
        ('FinFirst Capital','Amanda Wu, CMO','B2B lead generation and nurturing automation','qualified',65000,80,'[{"id":1,"title":"Lead Scoring Model","priority":"high","status":"confirmed"},{"id":2,"title":"Outbound Sequences","priority":"high","status":"confirmed"}]','Lead scoring AI model + 5 outbound sequences + monthly reporting.'),
        ('MedPro Network','Dr. James Park, CEO','Healthcare provider marketing compliance and patient acquisition','negotiation',95000,60,'[{"id":1,"title":"HIPAA Compliant Forms","priority":"high","status":"confirmed"},{"id":2,"title":"Patient Journey Mapping","priority":"high","status":"confirmed"},{"id":3,"title":"Referral Program","priority":"medium","status":"pending"}]','HIPAA-compliant marketing stack with patient journey automation.'),
        ('StartupBoost LLC','Kevin Torres, Founder','Full-stack digital marketing setup for Series A startup','closed_won',42000,100,'[{"id":1,"title":"Brand Identity","priority":"high","status":"done"},{"id":2,"title":"Website Launch","priority":"high","status":"done"},{"id":3,"title":"Ad Campaigns","priority":"medium","status":"in_progress"}]','Full brand + digital marketing suite launched in 30 days.')`);

      const oppRes = await client.query('SELECT id FROM consulting_opportunities ORDER BY id LIMIT 3');
      const opp1 = oppRes.rows[0]?.id; const opp2 = oppRes.rows[1]?.id; const opp3 = oppRes.rows[2]?.id;
      await client.query(`INSERT INTO consulting_deliveries (opportunity_id,name,status,milestones,team_members,start_date,end_date,health) VALUES
        ($1,'Apex Technologies Implementation','in_progress',
         '[{"name":"Requirements Sign-off","due":"2026-09-20","status":"done"},{"name":"CRM Integration","due":"2026-10-04","status":"in_progress"},{"name":"Email Automation Setup","due":"2026-10-18","status":"pending"},{"name":"Analytics Dashboard","due":"2026-11-01","status":"pending"},{"name":"UAT & Training","due":"2026-11-15","status":"pending"},{"name":"Go-Live","due":"2026-11-22","status":"pending"}]',
         ARRAY['Alice (PM)','Bob (Dev)','Carol (QA)'],'2026-09-16','2026-11-22','green'),
        ($2,'GlobalRetail Discovery Phase','planning',
         '[{"name":"Stakeholder Interviews","due":"2026-09-25","status":"pending"},{"name":"Current State Analysis","due":"2026-10-09","status":"pending"},{"name":"Requirements Workshop","due":"2026-10-16","status":"pending"},{"name":"Solution Proposal","due":"2026-10-30","status":"pending"}]',
         ARRAY['Diana (Consultant)','Evan (Analyst)'],'2026-09-20','2026-10-30','green'),
        ($3,'FinFirst Lead Gen Platform','in_progress',
         '[{"name":"Lead Scoring Model Config","due":"2026-09-18","status":"done"},{"name":"Sequence Builder","due":"2026-09-25","status":"in_progress"},{"name":"Integration Testing","due":"2026-10-02","status":"pending"},{"name":"Launch","due":"2026-10-09","status":"pending"}]',
         ARRAY['Frank (Dev)','Grace (PM)'],'2026-09-10','2026-10-09','amber')`,
        [opp1, opp2, opp3]);

      await client.query(`INSERT INTO consulting_upsell_playbooks (trigger_event,offer,script,success_rate) VALUES
        ('Project Go-Live','Annual Support & Optimization Package','Congratulations on launching! Most clients see the biggest gains in months 2-4 as they optimize. Our annual support package ensures you capture all of that value — and gives you priority access to our team. Would you like me to put together a proposal?',34.5),
        ('3-Month Check-in','Advanced Analytics Add-on','You mentioned wanting deeper insights into your campaign performance. We have an Advanced Analytics module that gives you attribution modeling, predictive analytics, and custom dashboards. Given what you have built, it would slot in seamlessly. Want to see a demo?',28.3),
        ('Contract Renewal','Platform Expansion to Additional Business Unit','As we renew, I wanted to mention that several clients at your stage have expanded to their second business unit. The incremental cost is only 40% of the original contract because most infrastructure is shared. Would that be worth exploring?',41.2),
        ('Support Ticket — Performance Issue','Performance Optimization Sprint','I see you have been dealing with [issue]. Our Performance Optimization Sprint addresses root causes systematically — past clients have seen 30-60% improvement. It is a focused 4-week engagement. Would a scoping call make sense?',22.7)`);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const opps = await client.query('SELECT * FROM consulting_opportunities ORDER BY created_at DESC');
    const pipeline = await client.query(`SELECT
      COUNT(*) AS total,
      SUM(value) AS total_value,
      SUM(value * win_probability / 100) AS weighted_value,
      COUNT(*) FILTER (WHERE stage='closed_won') AS won,
      ROUND(AVG(win_probability),1) AS avg_win_prob
      FROM consulting_opportunities`);
    return Response.json({ opportunities: opps.rows, pipeline: pipeline.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await provision();
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.client_name) return Response.json({ error: 'client_name required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO consulting_opportunities (client_name,contact,description,stage,value,win_probability) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.client_name, b.contact || null, b.description || null, b.stage || 'discovery', b.value || 0, b.win_probability || 50]
    );
    return Response.json({ opportunity: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
