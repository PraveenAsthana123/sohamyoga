export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      trigger_type TEXT DEFAULT 'manual',
      trigger_config JSONB DEFAULT '{}',
      status TEXT DEFAULT 'idle',
      last_run_at TIMESTAMPTZ,
      last_run_status TEXT,
      run_count INT DEFAULT 0,
      success_count INT DEFAULT 0,
      error_count INT DEFAULT 0,
      avg_duration_seconds NUMERIC(8,2),
      description TEXT,
      steps_json JSONB DEFAULT '[]',
      tool TEXT DEFAULT 'custom',
      roi_hours_saved_per_run NUMERIC(6,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS automation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES automation_jobs(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'running',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      duration_seconds NUMERIC(8,2),
      items_processed INT DEFAULT 0,
      errors_json JSONB DEFAULT '[]',
      output_json JSONB DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS automation_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      use_case TEXT,
      steps_json JSONB DEFAULT '[]',
      tool TEXT,
      estimated_hours_saved_per_month NUMERIC(6,1),
      difficulty TEXT DEFAULT 'easy',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await seedIfEmpty(pool);
}

async function seedIfEmpty(pool: ReturnType<typeof getPool>) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM automation_jobs');
  if (rows[0].cnt > 0) return;

  // Seed 15 automation jobs
  const jobs = [
    ['Competitor Price Scraper', 'rpa', 'scheduled', '{"cron":"0 6 * * *"}', 'active', 'n8n', 2.5, 'Scrapes competitor pricing pages daily and updates price comparison table'],
    ['CRM Contact Sync', 'api', 'webhook', '{"url":"/webhooks/crm-sync"}', 'active', 'zapier', 1.0, 'Syncs new contacts from form submissions to CRM in real-time'],
    ['New Lead Slack Notification', 'api', 'event', '{"event":"new_lead"}', 'active', 'n8n', 0.5, 'Pushes new qualified leads to #sales Slack channel with full context'],
    ['Email Auto-Reply Sequence', 'email', 'event', '{"event":"new_contact"}', 'active', 'custom', 3.0, 'Sends 5-step nurture sequence to new contacts over 14 days'],
    ['Meeting Follow-Up Notes', 'meeting', 'event', '{"event":"meeting_ended"}', 'idle', 'n8n', 1.5, 'Auto-generates and sends meeting notes + action items after each call'],
    ['Lead Auto-Qualification', 'crm', 'event', '{"event":"new_lead"}', 'active', 'custom', 4.0, 'Scores and qualifies leads using firmographic + behavioral signals'],
    ['LinkedIn Outreach Sequence', 'outbound', 'scheduled', '{"cron":"0 9 * * 1-5"}', 'idle', 'custom', 5.0, 'Sends personalized LinkedIn connection requests to ICP prospects'],
    ['Social Post Scheduler', 'social', 'scheduled', '{"cron":"0 8,12,17 * * *"}', 'active', 'n8n', 2.0, 'Auto-publishes queued social posts at optimal engagement times'],
    ['Weekly Revenue Report', 'data', 'scheduled', '{"cron":"0 7 * * 1"}', 'active', 'custom', 3.5, 'Compiles weekly revenue metrics and emails report to leadership'],
    ['Invoice Auto-Generator', 'document', 'event', '{"event":"order_completed"}', 'active', 'custom', 2.0, 'Generates PDF invoices on order completion and emails to customer'],
    ['Expense Categorizer', 'finance', 'scheduled', '{"cron":"0 23 * * *"}', 'active', 'n8n', 1.5, 'Categorizes daily expenses from bank feed using ML classification'],
    ['Support Ticket Router', 'support', 'event', '{"event":"new_ticket"}', 'active', 'zapier', 1.0, 'Routes incoming tickets to right agent based on topic + priority'],
    ['Employee Onboarding Checklist', 'hr', 'event', '{"event":"new_hire"}', 'idle', 'n8n', 6.0, 'Creates personalized onboarding task list and sends to new hire + manager'],
    ['Deal Stage Updater', 'crm', 'scheduled', '{"cron":"0 18 * * 1-5"}', 'active', 'custom', 2.5, 'Auto-advances deal stages based on email activity and time thresholds'],
    ['Auto-Reply Comment Bot', 'social', 'event', '{"event":"new_comment"}', 'error', 'n8n', 1.0, 'Replies to social media comments with relevant responses using AI'],
  ];

  const statusOptions = ['idle', 'active', 'active', 'active', 'paused', 'error'];
  const jobIds: string[] = [];
  for (const [name, category, triggerType, triggerConfig, status, tool, roi, description] of jobs) {
    const { rows: jr } = await pool.query(
      `INSERT INTO automation_jobs (name, category, trigger_type, trigger_config, status, tool, roi_hours_saved_per_run, description,
        run_count, success_count, error_count, avg_duration_seconds, last_run_at, last_run_status)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,
         floor(random()*100+5)::int, floor(random()*80+4)::int, floor(random()*5)::int,
         (random()*120+5)::numeric(8,2),
         NOW() - (random()*7 * interval '1 day'),
         CASE WHEN $5='error' THEN 'error' ELSE 'success' END)
       RETURNING id`,
      [name, category, triggerType, triggerConfig, status, tool, roi, description]
    );
    jobIds.push(jr[0].id);
  }

  // Seed 20 automation runs
  const runStatuses = ['success', 'success', 'success', 'error', 'success'];
  for (let i = 0; i < 20; i++) {
    const jobId = jobIds[i % jobIds.length];
    const st = runStatuses[i % runStatuses.length];
    const dur = (Math.random() * 120 + 3).toFixed(2);
    const items = Math.floor(Math.random() * 45 + 5);
    const errors = st === 'error' ? JSON.stringify([{ code: 'CONN_TIMEOUT', message: 'Connection timed out after 30s' }]) : '[]';
    await pool.query(
      `INSERT INTO automation_runs (job_id, status, started_at, ended_at, duration_seconds, items_processed, errors_json, output_json)
       VALUES ($1,$2,NOW()-($3::numeric||' seconds')::interval,NOW()-($3::numeric*0.1||' seconds')::interval,$3,$4,$5::jsonb,$6::jsonb)`,
      [jobId, st, dur, items, errors, JSON.stringify({ processed: items, status: st })]
    );
  }

  // Seed 12 automation templates
  const templates = [
    ['Competitor Price Watcher', 'rpa', 'Scrape competitor product pages and track price changes in a Google Sheet', 'Price monitoring for e-commerce', 'n8n', 12.0, 'easy'],
    ['Web Form Auto-Fill Bot', 'rpa', 'Automate repetitive data entry into web forms using RPA', 'Data entry automation', 'rpa_tool', 8.0, 'medium'],
    ['CRM Contact Sync Pipeline', 'api', 'Bi-directional sync between website forms and CRM system', 'CRM integration', 'zapier', 6.0, 'easy'],
    ['Slack Lead Alert', 'api', 'Push new leads from any source to a designated Slack channel', 'Lead notifications', 'n8n', 4.0, 'easy'],
    ['Drip Email Nurture Sequence', 'email', 'Send timed follow-up emails to new contacts over 30 days', 'Lead nurturing', 'custom', 15.0, 'medium'],
    ['Post-Meeting Notes Sender', 'meeting', 'Auto-generate and distribute meeting notes after calendar events end', 'Meeting productivity', 'n8n', 8.0, 'easy'],
    ['Lead Scoring Engine', 'crm', 'Automatically score leads based on behavior, firmographics, and engagement', 'Pipeline management', 'custom', 20.0, 'hard'],
    ['LinkedIn Connection Sequence', 'outbound', 'Send personalized LinkedIn connection requests + follow-up messages', 'Outbound prospecting', 'custom', 24.0, 'medium'],
    ['Social Media Post Scheduler', 'social', 'Queue and auto-publish content to multiple social platforms', 'Social media management', 'n8n', 10.0, 'easy'],
    ['Invoice PDF Generator', 'document', 'Auto-generate branded PDF invoices on order completion', 'Document automation', 'custom', 6.0, 'medium'],
    ['Expense Auto-Categorizer', 'finance', 'ML-based categorization of bank transactions and expenses', 'Financial operations', 'n8n', 5.0, 'hard'],
    ['New Hire Onboarding Flow', 'hr', 'Create checklist, send welcome emails, set up accounts on new hire creation', 'HR automation', 'n8n', 16.0, 'medium'],
  ];
  for (const [name, category, description, useCase, tool, hours, difficulty] of templates) {
    await pool.query(
      `INSERT INTO automation_templates (name, category, description, use_case, tool, estimated_hours_saved_per_month, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [name, category, description, useCase, tool, hours, difficulty]
    );
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureSchema();
    const pool = getPool();

    const [jobsRes, runsRes, templatesRes, statsRes] = await Promise.all([
      pool.query(`SELECT * FROM automation_jobs ORDER BY created_at DESC`),
      pool.query(`
        SELECT ar.*, aj.name AS job_name, aj.category
        FROM automation_runs ar
        LEFT JOIN automation_jobs aj ON aj.id = ar.job_id
        ORDER BY ar.started_at DESC LIMIT 100
      `),
      pool.query(`SELECT * FROM automation_templates ORDER BY category, name`),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_jobs,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_jobs,
          COUNT(*) FILTER (WHERE status = 'error')::int AS error_jobs,
          COUNT(*) FILTER (WHERE status = 'idle')::int AS idle_jobs,
          COALESCE(SUM(run_count), 0)::int AS total_runs,
          COALESCE(SUM(success_count), 0)::int AS total_successes,
          COALESCE(SUM(error_count), 0)::int AS total_errors,
          COALESCE(SUM(roi_hours_saved_per_run * run_count), 0)::numeric(10,2) AS total_hours_saved,
          CASE WHEN SUM(run_count) > 0 THEN (SUM(success_count)::numeric / SUM(run_count) * 100)::numeric(5,1) ELSE 0 END AS success_rate
        FROM automation_jobs
      `),
    ]);

    const kpi = statsRes.rows[0];
    // Category matrix
    const categoryRes = await pool.query(`
      SELECT category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='idle')::int AS idle,
        COUNT(*) FILTER (WHERE status='error')::int AS error_count
      FROM automation_jobs GROUP BY category ORDER BY category
    `);

    return Response.json({
      jobs: jobsRes.rows,
      runs: runsRes.rows,
      templates: templatesRes.rows,
      kpi: {
        totalJobs: kpi.total_jobs,
        activeJobs: kpi.active_jobs,
        errorJobs: kpi.error_jobs,
        idleJobs: kpi.idle_jobs,
        totalRuns: kpi.total_runs,
        totalSuccesses: kpi.total_successes,
        totalErrors: kpi.total_errors,
        totalHoursSaved: Number(kpi.total_hours_saved),
        successRate: Number(kpi.success_rate),
      },
      categoryMatrix: categoryRes.rows,
    });
  } catch (err) {
    console.error('[ai-automation GET]', err);
    return Response.json({ error: 'Failed to load automation data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureSchema();
    const body = await req.json() as {
      name: string; category: string; trigger_type?: string; trigger_config?: object;
      description?: string; steps_json?: object[]; tool?: string; roi_hours_saved_per_run?: number;
    };
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO automation_jobs (name, category, trigger_type, trigger_config, description, steps_json, tool, roi_hours_saved_per_run)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8) RETURNING *`,
      [
        body.name, body.category, body.trigger_type ?? 'manual',
        JSON.stringify(body.trigger_config ?? {}),
        body.description ?? null,
        JSON.stringify(body.steps_json ?? []),
        body.tool ?? 'custom',
        body.roi_hours_saved_per_run ?? null,
      ]
    );
    return Response.json({ job: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[ai-automation POST]', err);
    return Response.json({ error: 'Failed to create automation job' }, { status: 500 });
  }
}
