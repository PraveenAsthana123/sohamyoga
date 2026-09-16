export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        pipeline_type TEXT DEFAULT 'data',
        description TEXT,
        stages JSONB DEFAULT '[]',
        status TEXT DEFAULT 'active',
        trigger_type TEXT DEFAULT 'manual',
        cron_expression TEXT,
        last_run_at TIMESTAMPTZ,
        last_run_status TEXT,
        last_run_duration_ms INTEGER,
        avg_duration_ms INTEGER,
        success_rate NUMERIC DEFAULT 100,
        run_count INTEGER DEFAULT 0,
        stage_count INTEGER DEFAULT 0,
        owner TEXT,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_run (
        id BIGSERIAL PRIMARY KEY,
        pipeline_id INTEGER REFERENCES pipeline(id) ON DELETE CASCADE,
        run_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'running',
        triggered_by TEXT DEFAULT 'manual',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        duration_ms INTEGER,
        stages_completed INTEGER DEFAULT 0,
        stages_total INTEGER DEFAULT 0,
        records_in INTEGER DEFAULT 0,
        records_out INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        error_stage TEXT,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);

    const seeds = [
      ['Social Content Pipeline', 'content', 'Fetch → Schedule → Publish → Analyze', '[{"name":"Fetch Drafts","type":"extract","order":1},{"name":"AI Enhancement","type":"transform","order":2},{"name":"Schedule Posts","type":"load","order":3},{"name":"Track Engagement","type":"monitor","order":4}]'],
      ['Ad Performance ETL', 'etl', 'Sync ad metrics from platforms to DB', '[{"name":"Pull Ad Metrics","type":"extract","order":1},{"name":"Normalize Data","type":"transform","order":2},{"name":"Store in DB","type":"load","order":3},{"name":"Update KPIs","type":"aggregate","order":4}]'],
      ['Lead Nurturing Pipeline', 'marketing', 'New lead → segment → email → CRM', '[{"name":"Detect New Lead","type":"trigger","order":1},{"name":"Segment Lead","type":"classify","order":2},{"name":"Send Welcome Email","type":"action","order":3},{"name":"Add to CRM","type":"load","order":4}]'],
      ['AI RAG Ingestion', 'ai', 'Ingest docs → chunk → embed → store', '[{"name":"Load Documents","type":"extract","order":1},{"name":"Chunk Text","type":"transform","order":2},{"name":"Generate Embeddings","type":"ai","order":3},{"name":"Store Vectors","type":"load","order":4}]'],
      ['Market Research Pipeline', 'ml', 'Collect → analyze → report', '[{"name":"Collect Data","type":"extract","order":1},{"name":"Statistical Analysis","type":"analyze","order":2},{"name":"ML Classification","type":"ml","order":3},{"name":"Generate Report","type":"output","order":4}]'],
      ['Customer Event Stream', 'data', 'Track → segment → trigger actions', '[{"name":"Receive Events","type":"stream","order":1},{"name":"Enrich Events","type":"transform","order":2},{"name":"Update Segments","type":"aggregate","order":3},{"name":"Trigger Automations","type":"action","order":4}]'],
    ];

    for (const [name, type, desc, stages] of seeds) {
      await client.query(
        `INSERT INTO pipeline (name, pipeline_type, description, stages, stage_count, trigger_type)
         VALUES ($1, $2, $3, $4::jsonb, 4, 'cron')
         ON CONFLICT (name) DO NOTHING`,
        [name, type, desc, stages]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT p.*,
        r.status AS latest_run_status,
        r.started_at AS latest_run_at,
        r.duration_ms AS latest_run_duration_ms,
        r.run_id AS latest_run_id
      FROM pipeline p
      LEFT JOIN LATERAL (
        SELECT status, started_at, duration_ms, run_id
        FROM pipeline_run
        WHERE pipeline_id = p.id
        ORDER BY started_at DESC
        LIMIT 1
      ) r ON true
      ORDER BY p.created_at ASC
    `).catch(() => ({ rows: [] }));
    return Response.json({ pipelines: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const body = await req.json().catch(() => ({}));
  const { name, pipeline_type, description, trigger_type, cron_expression, owner, tags, stages } = body;
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const stagesJson = JSON.stringify(
    Array.isArray(stages) ? stages.map((s: { name: string; type: string }, i: number) => ({ ...s, order: i + 1 })) : []
  );

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO pipeline (name, pipeline_type, description, trigger_type, cron_expression, owner, tags, stages, stage_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [name, pipeline_type || 'data', description || '', trigger_type || 'manual', cron_expression || null, owner || null, tags || [], stagesJson, Array.isArray(stages) ? stages.length : 0]
    ).catch(() => ({ rows: [] }));
    return Response.json({ pipeline: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { id, status, cron_expression, stages } = body;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(status); }
    if (cron_expression !== undefined) { sets.push(`cron_expression = $${idx++}`); params.push(cron_expression); }
    if (stages !== undefined) {
      sets.push(`stages = $${idx++}::jsonb`);
      sets.push(`stage_count = $${idx++}`);
      params.push(JSON.stringify(stages));
      params.push(Array.isArray(stages) ? stages.length : 0);
    }
    if (!sets.length) return Response.json({ error: 'nothing to update' }, { status: 400 });
    params.push(id);
    const { rows } = await client.query(`UPDATE pipeline SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params).catch(() => ({ rows: [] }));
    return Response.json({ pipeline: rows[0] });
  } finally {
    client.release();
  }
}
