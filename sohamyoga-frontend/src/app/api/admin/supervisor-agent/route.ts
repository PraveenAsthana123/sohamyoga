import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS supervisor_workers (
        worker_id VARCHAR(64) PRIMARY KEY,
        worker_type VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'idle',
        current_task TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        last_heartbeat TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS supervisor_queue (
        task_id VARCHAR(64) UNIQUE NOT NULL,
        priority VARCHAR(4) NOT NULL DEFAULT 'P2',
        task_type VARCHAR(64) NOT NULL,
        assigned_worker VARCHAR(64),
        status VARCHAR(16) NOT NULL DEFAULT 'queued',
        retry_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS supervisor_escalations (
        id SERIAL PRIMARY KEY,
        task_id VARCHAR(64) NOT NULL,
        reason TEXT,
        resolution TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS supervisor_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(8) NOT NULL DEFAULT 'INFO',
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const { rows: wRows } = await client.query('SELECT COUNT(*) FROM supervisor_workers');
    if (parseInt(wRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO supervisor_workers (worker_id, worker_type, status, current_task, started_at, last_heartbeat) VALUES
        ('worker-001', 'LLM',      'busy',    'Summarise blog post #42',   NOW() - INTERVAL '4 hours',  NOW() - INTERVAL '30 seconds'),
        ('worker-002', 'Tool',     'idle',    NULL,                         NOW() - INTERVAL '2 hours',  NOW() - INTERVAL '10 seconds'),
        ('worker-003', 'Pipeline', 'busy',    'Ingest Google Drive batch',  NOW() - INTERVAL '6 hours',  NOW() - INTERVAL '15 seconds'),
        ('worker-004', 'Retrieval','idle',    NULL,                         NOW() - INTERVAL '1 hour',   NOW() - INTERVAL '5 seconds'),
        ('worker-005', 'LLM',      'error',   'Generate ad copy for campaign-7', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '5 minutes')
      `);
    }

    const { rows: qRows } = await client.query('SELECT COUNT(*) FROM supervisor_queue');
    if (parseInt(qRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO supervisor_queue (task_id, priority, task_type, assigned_worker, status, retry_count, created_at) VALUES
        ('task-qa-001', 'P0', 'llm_summarise',       'worker-001', 'running',   0, NOW() - INTERVAL '10 minutes'),
        ('task-qa-002', 'P1', 'tool_web_search',     'worker-002', 'queued',    0, NOW() - INTERVAL '8 minutes'),
        ('task-qa-003', 'P1', 'pipeline_ingest',     'worker-003', 'running',   1, NOW() - INTERVAL '20 minutes'),
        ('task-qa-004', 'P2', 'retrieval_semantic',  NULL,         'queued',    0, NOW() - INTERVAL '5 minutes'),
        ('task-qa-005', 'P2', 'llm_translate',       NULL,         'queued',    0, NOW() - INTERVAL '3 minutes'),
        ('task-qa-006', 'P3', 'tool_email_send',     NULL,         'queued',    0, NOW() - INTERVAL '2 minutes'),
        ('task-qa-007', 'P0', 'llm_ad_copy',         'worker-005', 'failed',    3, NOW() - INTERVAL '30 minutes'),
        ('task-qa-008', 'P2', 'pipeline_export_csv', NULL,         'queued',    0, NOW() - INTERVAL '1 minute')
      `);
    }

    const { rows: eRows } = await client.query('SELECT COUNT(*) FROM supervisor_escalations');
    if (parseInt(eRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO supervisor_escalations (task_id, reason, resolution, created_at) VALUES
        ('task-qa-007', 'LLM returned empty output after 3 retries — token quota exceeded', 'Switched to fallback model; re-queued on worker-002', NOW() - INTERVAL '25 minutes'),
        ('task-old-002', 'Tool call timeout after 30s — external API unreachable',           'Alert sent to admin; task parked for manual review',  NOW() - INTERVAL '2 hours'),
        ('task-old-003', 'Pipeline stuck — upstream DB lock not released within SLA',        'DB lock cleared by watchdog; pipeline resumed',        NOW() - INTERVAL '5 hours')
      `);
    }

    const { rows: lRows } = await client.query('SELECT COUNT(*) FROM supervisor_logs');
    if (parseInt(lRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO supervisor_logs (level, message, created_at) VALUES
        ('INFO',  'Supervisor started — 5 workers initialised',                           NOW() - INTERVAL '6 hours'),
        ('INFO',  'worker-001 picked up task-qa-001 (llm_summarise)',                     NOW() - INTERVAL '10 minutes'),
        ('INFO',  'worker-003 started pipeline_ingest (task-qa-003)',                     NOW() - INTERVAL '20 minutes'),
        ('WARN',  'worker-005 retry 1/3 on task-qa-007 — empty LLM response',             NOW() - INTERVAL '28 minutes'),
        ('WARN',  'worker-005 retry 2/3 on task-qa-007',                                  NOW() - INTERVAL '26 minutes'),
        ('ERROR', 'worker-005 failed task-qa-007 after 3 retries — escalated',            NOW() - INTERVAL '25 minutes'),
        ('INFO',  'Escalation handler triggered for task-qa-007',                         NOW() - INTERVAL '25 minutes'),
        ('INFO',  'Heartbeat OK — all 4 healthy workers reported within 60s',             NOW() - INTERVAL '1 minute'),
        ('WARN',  'Queue depth reached 6 — consider scaling worker pool',                 NOW() - INTERVAL '30 seconds'),
        ('INFO',  'Settings refreshed: max_workers=10 retry_limit=3 threshold=5',         NOW() - INTERVAL '10 seconds')
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [workers, queue, escalations, logs] = await Promise.all([
      client.query('SELECT * FROM supervisor_workers ORDER BY started_at DESC'),
      client.query('SELECT * FROM supervisor_queue ORDER BY CASE priority WHEN \'P0\' THEN 0 WHEN \'P1\' THEN 1 WHEN \'P2\' THEN 2 ELSE 3 END, created_at ASC'),
      client.query('SELECT * FROM supervisor_escalations ORDER BY created_at DESC LIMIT 50'),
      client.query('SELECT * FROM supervisor_logs ORDER BY created_at DESC LIMIT 100'),
    ]);
    return Response.json({
      workers: workers.rows,
      queue: queue.rows,
      escalations: escalations.rows,
      logs: logs.rows,
      settings: { max_workers: 10, retry_limit: 3, escalation_threshold: 5 },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as { task_type?: string; priority?: string; input_data?: string } | null;
  if (!body?.task_type) {
    return Response.json({ error: 'task_type required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const taskId = `task-${Date.now()}`;
    const priority = body.priority || 'P2';
    const { rows } = await client.query(
      `INSERT INTO supervisor_queue (task_id, priority, task_type, status, retry_count)
       VALUES ($1, $2, $3, 'queued', 0) RETURNING *`,
      [taskId, priority, body.task_type],
    );
    await client.query(
      `INSERT INTO supervisor_logs (level, message) VALUES ('INFO', $1)`,
      [`Task ${taskId} (${body.task_type}) added to queue at priority ${priority}`],
    );
    return Response.json({ task: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as { entity?: string; id?: string; status?: string } | null;
  if (!body?.entity || !body?.id || !body?.status) {
    return Response.json({ error: 'entity, id, status required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.entity === 'worker') {
      await client.query(
        `UPDATE supervisor_workers SET status = $1, last_heartbeat = NOW() WHERE worker_id = $2`,
        [body.status, body.id],
      );
    } else if (body.entity === 'task') {
      await client.query(
        `UPDATE supervisor_queue SET status = $1 WHERE task_id = $2`,
        [body.status, body.id],
      );
    } else {
      return Response.json({ error: 'entity must be worker or task' }, { status: 400 });
    }
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
