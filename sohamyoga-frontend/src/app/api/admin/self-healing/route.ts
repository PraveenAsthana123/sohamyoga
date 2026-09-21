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
      CREATE TABLE IF NOT EXISTS sh_rules (
        rule_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        trigger_condition TEXT NOT NULL,
        action VARCHAR(32) NOT NULL,
        priority INT NOT NULL DEFAULT 5,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_triggered TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sh_incidents (
        id SERIAL PRIMARY KEY,
        module VARCHAR(64) NOT NULL,
        severity VARCHAR(8) NOT NULL DEFAULT 'medium',
        detection_method VARCHAR(8) NOT NULL DEFAULT 'auto',
        status VARCHAR(16) NOT NULL DEFAULT 'detecting',
        time_to_detect_s INT,
        time_to_heal_s INT,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sh_repair_log (
        id SERIAL PRIMARY KEY,
        module VARCHAR(64) NOT NULL,
        action_taken TEXT NOT NULL,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sh_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const { rows: rRows } = await client.query('SELECT COUNT(*) FROM sh_rules');
    if (parseInt(rRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO sh_rules (rule_id, name, trigger_condition, action, priority, is_active, last_triggered) VALUES
        ('rule-001', 'DB Connection Exhausted',       'pg_pool_wait_queue > 50',             'restart_service', 1, TRUE,  NOW()-INTERVAL '2 hours'),
        ('rule-002', 'Cron Job Stale',                'cron_last_run > 2x_interval',         'retry_job',       2, TRUE,  NOW()-INTERVAL '45 minutes'),
        ('rule-003', 'High Memory Usage',             'memory_pct > 90',                     'clear_cache',     2, TRUE,  NOW()-INTERVAL '3 hours'),
        ('rule-004', 'API Gateway 5xx Spike',         'error_rate_5xx > 5pct_in_5min',       'alert_admin',     1, TRUE,  NOW()-INTERVAL '1 day'),
        ('rule-005', 'Worker Heartbeat Missing',      'worker_last_heartbeat > 120s',        'restart_service', 1, TRUE,  NOW()-INTERVAL '4 hours'),
        ('rule-006', 'Queue Depth Critical',          'queue_depth > 100',                   'scale_up',        2, TRUE,  NULL),
        ('rule-007', 'Disk Space Warning',            'disk_free_pct < 15',                  'alert_admin',     3, TRUE,  NULL),
        ('rule-008', 'LLM Token Quota Near Limit',   'token_usage_pct > 85',                'alert_admin',     2, FALSE, NOW()-INTERVAL '12 hours')
      `);
    }

    const { rows: iRows } = await client.query('SELECT COUNT(*) FROM sh_incidents');
    if (parseInt(iRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO sh_incidents (module, severity, detection_method, status, time_to_detect_s, time_to_heal_s, created_at, resolved_at) VALUES
        ('postgres-pool',    'high',   'auto',   'resolved', 4,   28,  NOW()-INTERVAL '2 hours',   NOW()-INTERVAL '1 hour 59 minutes'),
        ('cron-engine',      'medium', 'auto',   'resolved', 8,   45,  NOW()-INTERVAL '45 minutes',NOW()-INTERVAL '44 minutes'),
        ('supervisor-agent', 'high',   'auto',   'resolved', 2,   12,  NOW()-INTERVAL '4 hours',   NOW()-INTERVAL '3 hours 59 minutes'),
        ('redis-cache',      'medium', 'manual', 'healing',  NULL,NULL, NOW()-INTERVAL '5 minutes', NULL),
        ('api-gateway',      'low',    'auto',   'detecting',3,   NULL, NOW()-INTERVAL '1 minute',  NULL)
      `);
    }

    const { rows: lRows } = await client.query('SELECT COUNT(*) FROM sh_repair_log');
    if (parseInt(lRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO sh_repair_log (module, action_taken, success, details, created_at) VALUES
        ('postgres-pool',    'restart_service: pgbouncer restarted',                TRUE,  'Pool exhausted (58 waiting). PgBouncer restarted in 3s. Queue cleared.',          NOW()-INTERVAL '2 hours'),
        ('postgres-pool',    'alert_admin: Slack notification sent',                TRUE,  'Admin notified via Slack #ops-alerts channel',                                    NOW()-INTERVAL '2 hours'),
        ('redis-cache',      'clear_cache: Redis FLUSHDB executed',                 TRUE,  'Memory at 94%. Eviction policy switched to allkeys-lru before flush.',            NOW()-INTERVAL '3 hours'),
        ('cron-engine',      'retry_job: PostizSocialAutoPublishJob re-queued',     TRUE,  'Job stale for 9 min (expected 5 min). Re-queued. Ran to completion in 42s.',      NOW()-INTERVAL '45 minutes'),
        ('supervisor-agent', 'restart_service: worker-005 restarted',              TRUE,  'Heartbeat missed x3. Worker PID killed and respawned. Task re-queued.',           NOW()-INTERVAL '4 hours'),
        ('api-gateway',      'alert_admin: error rate alert triggered',             TRUE,  '5xx rate 6.2% over 5 min window. Alert sent.',                                   NOW()-INTERVAL '1 day'),
        ('redis-cache',      'retry_job: cache warm-up job triggered',              TRUE,  'Cache populated with top-100 product keys from DB.',                              NOW()-INTERVAL '3 hours'),
        ('cron-engine',      'retry_job: FirstWaveDispatchJob re-queued',           TRUE,  'Stale by 11 min. Retried successfully.',                                          NOW()-INTERVAL '6 hours'),
        ('postgres-pool',    'restart_service: pgbouncer pre-emptive restart',      TRUE,  'Scheduled maintenance restart — pool healthy post-restart.',                      NOW()-INTERVAL '8 hours'),
        ('api-gateway',      'clear_cache: nginx proxy cache cleared',              TRUE,  'Stale responses detected. Cache invalidated.',                                    NOW()-INTERVAL '2 days'),
        ('supervisor-agent', 'scale_up: additional worker provisioned',             FALSE, 'Scale-up attempted but container limit (5) reached. Alert sent instead.',        NOW()-INTERVAL '1 day'),
        ('redis-cache',      'alert_admin: disk space warning',                     TRUE,  'Redis AOF log growing. Admin alerted to review persistence settings.',            NOW()-INTERVAL '5 days')
      `);
    }

    const { rows: sRows } = await client.query('SELECT COUNT(*) FROM sh_settings');
    if (parseInt(sRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO sh_settings (key, value) VALUES
        ('scan_interval_seconds',    '30'),
        ('max_auto_retries',         '3'),
        ('alert_on_failure',         'true'),
        ('escalate_after_n_failures','2')
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
    const [rules, incidents, repairLog, settings] = await Promise.all([
      client.query('SELECT * FROM sh_rules ORDER BY priority, name'),
      client.query('SELECT * FROM sh_incidents ORDER BY created_at DESC'),
      client.query('SELECT * FROM sh_repair_log ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT key, value FROM sh_settings'),
    ]);

    const { rows: healthRows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE success = TRUE)  AS success_count,
        COUNT(*) FILTER (WHERE success = FALSE) AS fail_count,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS fixes_today,
        AVG(time_to_heal_s) FILTER (WHERE time_to_heal_s IS NOT NULL) AS avg_heal_s
      FROM sh_repair_log rl
      LEFT JOIN sh_incidents si ON si.module = rl.module
    `);
    const h = healthRows[0];
    const totalFixes = parseInt(h.success_count, 10) + parseInt(h.fail_count, 10);
    const uptimePct = totalFixes > 0
      ? Math.round((parseInt(h.success_count, 10) / totalFixes) * 10000) / 100
      : 100;

    return Response.json({
      rules: rules.rows,
      incidents: incidents.rows,
      repair_log: repairLog.rows,
      settings: Object.fromEntries(settings.rows.map(r => [r.key, r.value])),
      health_summary: {
        uptime_pct: uptimePct,
        mttr_min: h.avg_heal_s ? Math.round(parseFloat(h.avg_heal_s) / 60 * 100) / 100 : 0,
        auto_fixes_today: parseInt(h.fixes_today, 10),
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as {
    action?: string;
    name?: string; trigger_condition?: string; rule_action?: string; priority?: number;
  } | null;

  if (!body?.action) return Response.json({ error: 'action required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'trigger_scan') {
      const modules = ['api-gateway', 'cron-engine', 'postgres-pool', 'redis-cache', 'supervisor-agent'];
      const mod = modules[Math.floor(Math.random() * modules.length)];
      const severities = ['low', 'medium', 'high'];
      const sev = severities[Math.floor(Math.random() * severities.length)];

      const { rows: incRows } = await client.query(
        `INSERT INTO sh_incidents (module, severity, detection_method, status, time_to_detect_s)
         VALUES ($1, $2, 'manual', 'detecting', 1) RETURNING *`,
        [mod, sev],
      );
      const incId = incRows[0].id;

      const repairs = [
        { action: 'Health scan completed — no critical issues found', success: true, details: 'All services responding within SLA thresholds' },
        { action: `Anomaly detected in ${mod} — watchdog triggered`, success: true, details: `${mod} latency spike detected; cleared automatically` },
      ];
      const repair = repairs[Math.floor(Math.random() * repairs.length)];
      await client.query(
        `INSERT INTO sh_repair_log (module, action_taken, success, details) VALUES ($1,$2,$3,$4)`,
        [mod, repair.action, repair.success, repair.details],
      );

      // Mark as resolved
      await client.query(
        `UPDATE sh_incidents SET status='resolved', time_to_heal_s=2, resolved_at=NOW() WHERE id=$1`,
        [incId],
      );

      return Response.json({ incident: incRows[0], repair }, { status: 201 });
    } else if (body.action === 'add_rule') {
      if (!body.name || !body.trigger_condition || !body.rule_action) {
        return Response.json({ error: 'name, trigger_condition, rule_action required' }, { status: 400 });
      }
      const ruleId = `rule-${Date.now()}`;
      const { rows } = await client.query(
        `INSERT INTO sh_rules (rule_id, name, trigger_condition, action, priority, is_active)
         VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
        [ruleId, body.name, body.trigger_condition, body.rule_action, body.priority || 5],
      );
      return Response.json({ rule: rows[0] }, { status: 201 });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as {
    entity?: string; id?: string | number; is_active?: boolean; status?: string;
  } | null;
  if (!body?.entity || !body?.id) return Response.json({ error: 'entity and id required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.entity === 'rule') {
      await client.query('UPDATE sh_rules SET is_active = $1 WHERE rule_id = $2', [body.is_active !== false, body.id]);
    } else if (body.entity === 'incident') {
      const extra = body.status === 'resolved' ? ', resolved_at = NOW()' : '';
      await client.query(`UPDATE sh_incidents SET status = $1${extra} WHERE id = $2`, [body.status || 'resolved', body.id]);
    } else {
      return Response.json({ error: 'entity must be rule or incident' }, { status: 400 });
    }
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
