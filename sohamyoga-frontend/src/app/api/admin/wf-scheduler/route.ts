export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wf_definition (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT DEFAULT 'manual',
        trigger_config JSONB DEFAULT '{}',
        steps JSONB DEFAULT '[]',
        status TEXT DEFAULT 'active',
        last_run_at TIMESTAMPTZ,
        last_run_status TEXT,
        run_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS wf_run (
        id SERIAL PRIMARY KEY,
        wf_id INTEGER REFERENCES wf_definition(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'running',
        current_step INTEGER DEFAULT 0,
        steps_completed INTEGER DEFAULT 0,
        steps_total INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        error_message TEXT,
        triggered_by TEXT DEFAULT 'manual'
      )
    `);

    const countRes = await client.query(`SELECT COUNT(*) AS c FROM wf_definition`);
    if (parseInt(countRes.rows[0].c as string, 10) === 0) {
      const seeds = [
        {
          name: 'New Lead Nurturing',
          description: 'Automated nurturing sequence for new leads',
          trigger_type: 'event',
          trigger_config: { event: 'new_lead' },
          steps: [
            { step_name: 'welcome_email', job_name: 'LeadNurturingJob', delay_ms: 0 },
            { step_name: 'wait_1day', job_name: null, delay_ms: 86400000 },
            { step_name: 'follow_up_email', job_name: 'LeadNurturingJob', delay_ms: 0 },
            { step_name: 'add_to_crm_segment', job_name: null, delay_ms: 0 },
          ],
        },
        {
          name: 'Weekly Report',
          description: 'Generate and send weekly analytics report',
          trigger_type: 'cron',
          trigger_config: { cron: '0 9 * * 1' },
          steps: [
            { step_name: 'generate_analytics_report', job_name: 'AdPlannerSyncJob', delay_ms: 0 },
            { step_name: 'send_to_admins', job_name: 'FirstWaveDispatchJob', delay_ms: 0 },
          ],
        },
        {
          name: 'Campaign Launch',
          description: 'Full campaign launch sequence',
          trigger_type: 'manual',
          trigger_config: {},
          steps: [
            { step_name: 'validate_budget', job_name: null, delay_ms: 0 },
            { step_name: 'create_ad_groups', job_name: 'GoogleAdsSyncJob', delay_ms: 0 },
            { step_name: 'enable_campaign', job_name: 'AdPlannerSyncJob', delay_ms: 0 },
            { step_name: 'notify_team', job_name: 'FirstWaveDispatchJob', delay_ms: 0 },
          ],
        },
      ];
      for (const s of seeds) {
        await client.query(
          `INSERT INTO wf_definition (name, description, trigger_type, trigger_config, steps)
           VALUES ($1,$2,$3,$4,$5)`,
          [s.name, s.description, s.trigger_type, JSON.stringify(s.trigger_config), JSON.stringify(s.steps)]
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
    const [workflowsRes, runsRes] = await Promise.all([
      client.query(`
        SELECT w.*,
               wr.status AS latest_run_status,
               wr.started_at AS latest_run_started_at,
               wr.finished_at AS latest_run_finished_at
        FROM wf_definition w
        LEFT JOIN LATERAL (
          SELECT status, started_at, finished_at
          FROM wf_run
          WHERE wf_id = w.id
          ORDER BY started_at DESC
          LIMIT 1
        ) wr ON true
        ORDER BY w.created_at DESC
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT wr.*, w.name AS workflow_name
        FROM wf_run wr
        JOIN wf_definition w ON w.id = wr.wf_id
        ORDER BY wr.started_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),
    ]);
    return Response.json({ workflows: workflowsRes.rows, runs: runsRes.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    description?: string;
    trigger_type?: string;
    trigger_config?: unknown;
    steps?: unknown;
  };
  if (!body.name) return Response.json({ error: 'name required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO wf_definition (name, description, trigger_type, trigger_config, steps)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [
        body.name,
        body.description ?? '',
        body.trigger_type ?? 'manual',
        JSON.stringify(body.trigger_config ?? {}),
        JSON.stringify(body.steps ?? []),
      ]
    ).catch(() => ({ rows: [] }));
    return Response.json({ ok: true, id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    id?: number;
    status?: string;
    name?: string;
    description?: string;
  };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.status !== undefined) { fields.push(`status=$${idx++}`); params.push(body.status); }
    if (body.name !== undefined) { fields.push(`name=$${idx++}`); params.push(body.name); }
    if (body.description !== undefined) { fields.push(`description=$${idx++}`); params.push(body.description); }
    if (fields.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });
    params.push(body.id);
    await client.query(`UPDATE wf_definition SET ${fields.join(', ')} WHERE id=$${idx}`, params).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
