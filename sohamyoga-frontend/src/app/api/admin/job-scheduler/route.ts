export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

const SEED_JOBS = [
  ['AdPlannerSyncJob', 'AdPlannerSyncJob', '0 */6 * * *', 'Sync ad planner data'],
  ['CalendarSyncJob', 'CalendarSyncJob', '*/30 * * * *', 'Sync calendar events'],
  ['PostizSocialAutoPublishJob', 'PostizSocialAutoPublishJob', '*/15 * * * *', 'Auto-publish social posts'],
  ['FirstWaveDispatchJob', 'FirstWaveDispatchJob', '0 8 * * *', 'Morning dispatch'],
  ['LeadNurturingJob', 'LeadNurturingJob', '0 10 * * *', 'Lead nurturing emails'],
  ['WellnessScoringJob', 'WellnessScoringJob', '0 0 * * *', 'Daily wellness scoring'],
  ['BadgeAwardJob', 'BadgeAwardJob', '0 1 * * *', 'Award badges'],
  ['MilestoneCheckJob', 'MilestoneCheckJob', '0 2 * * *', 'Check milestones'],
  ['VideoProcessingJob', 'VideoProcessingJob', '*/10 * * * *', 'Process video queue'],
  ['BrandProfileDraftJob', 'BrandProfileDraftJob', '0 3 * * 1', 'Weekly brand profile'],
  ['GoogleAdsSyncJob', 'GoogleAdsSyncJob', '0 */4 * * *', 'Sync Google Ads data'],
];

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_job (
        id SERIAL PRIMARY KEY,
        job_name TEXT UNIQUE NOT NULL,
        job_class TEXT,
        cron_expression TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        last_run_status TEXT,
        last_run_duration_ms INTEGER,
        last_error TEXT,
        run_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        avg_duration_ms INTEGER,
        timeout_ms INTEGER DEFAULT 300000,
        max_retries INTEGER DEFAULT 3,
        security_level TEXT DEFAULT 'internal',
        allowed_roles TEXT[] DEFAULT '{Admin}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_run_log (
        id BIGSERIAL PRIMARY KEY,
        job_name TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ,
        status TEXT,
        duration_ms INTEGER,
        error_message TEXT,
        records_processed INTEGER DEFAULT 0,
        triggered_by TEXT DEFAULT 'cron',
        run_metadata JSONB DEFAULT '{}'
      )
    `);

    // Check if empty and seed
    const countRes = await client.query(`SELECT COUNT(*) AS c FROM scheduled_job`);
    if (parseInt(countRes.rows[0].c as string, 10) === 0) {
      for (const [job_name, job_class, cron, desc] of SEED_JOBS) {
        await client.query(
          `INSERT INTO scheduled_job (job_name, job_class, cron_expression, description)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (job_name) DO NOTHING`,
          [job_name, job_class, cron, desc]
        ).catch(() => {});
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT sj.*,
             rl.started_at AS latest_started_at,
             rl.status AS latest_run_status,
             rl.duration_ms AS latest_duration_ms,
             rl.triggered_by AS latest_triggered_by
      FROM scheduled_job sj
      LEFT JOIN LATERAL (
        SELECT started_at, status, duration_ms, triggered_by
        FROM job_run_log
        WHERE job_name = sj.job_name
        ORDER BY started_at DESC
        LIMIT 1
      ) rl ON true
      ORDER BY sj.job_name
    `).catch(() => ({ rows: [] }));
    return Response.json({ jobs: result.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    job_name?: string;
    status?: string;
    cron_expression?: string;
    timeout_ms?: number;
    max_retries?: number;
  };
  if (!body.job_name) return Response.json({ error: 'job_name required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.status !== undefined) { fields.push(`status=$${idx++}`); params.push(body.status); }
    if (body.cron_expression !== undefined) { fields.push(`cron_expression=$${idx++}`); params.push(body.cron_expression); }
    if (body.timeout_ms !== undefined) { fields.push(`timeout_ms=$${idx++}`); params.push(body.timeout_ms); }
    if (body.max_retries !== undefined) { fields.push(`max_retries=$${idx++}`); params.push(body.max_retries); }

    if (fields.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

    params.push(body.job_name);
    await client.query(
      `UPDATE scheduled_job SET ${fields.join(', ')} WHERE job_name=$${idx}`,
      params
    ).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
