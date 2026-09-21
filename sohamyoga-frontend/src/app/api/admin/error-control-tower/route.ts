import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ect_errors (
        id SERIAL PRIMARY KEY,
        error_id VARCHAR(50) UNIQUE NOT NULL,
        module VARCHAR(100) NOT NULL,
        error_type VARCHAR(50) NOT NULL,
        severity VARCHAR(10) NOT NULL DEFAULT 'P2',
        message TEXT NOT NULL,
        stack_trace TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        resolved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ect_module_health (
        module VARCHAR(100) PRIMARY KEY,
        health_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        error_count INT NOT NULL DEFAULT 0,
        last_checked TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Pre-seed module health if empty
    const existing = await client.query('SELECT COUNT(*) FROM ect_module_health');
    if (parseInt(existing.rows[0].count) === 0) {
      const modules = [
        ['social', 'healthy'],
        ['analytics', 'healthy'],
        ['leads', 'healthy'],
        ['cron', 'warning'],
        ['auth', 'healthy'],
        ['database', 'healthy'],
        ['api', 'healthy'],
        ['frontend', 'healthy'],
        ['campaigns', 'healthy'],
        ['orders', 'warning'],
        ['payments', 'healthy'],
        ['email', 'healthy'],
        ['videos', 'healthy'],
        ['affiliates', 'healthy'],
        ['referral', 'healthy'],
        ['students', 'healthy'],
        ['blog', 'healthy'],
        ['notifications', 'healthy'],
        ['search', 'unknown'],
        ['integrations', 'warning'],
      ];
      for (const [mod, status] of modules) {
        await client.query(
          `INSERT INTO ect_module_health (module, health_status, error_count, last_checked)
           VALUES ($1, $2, 0, NOW()) ON CONFLICT (module) DO NOTHING`,
          [mod, status],
        );
      }
    }

    // Pre-seed some realistic errors if empty
    const errCount = await client.query('SELECT COUNT(*) FROM ect_errors');
    if (parseInt(errCount.rows[0].count) === 0) {
      const seed = [
        ['ECT-0001', 'cron', 'Runtime', 'P2', 'PostizSocialAutoPublishJob: token refresh failed for instagram account #12', null, 'open'],
        ['ECT-0002', 'integrations', 'API', 'P1', 'Stripe webhook signature verification failed — missing STRIPE_WEBHOOK_SECRET', null, 'investigating'],
        ['ECT-0003', 'auth', 'Auth', 'P0', 'JWT secret rotation caused 503 on /api/auth/session for 2 minutes', null, 'resolved'],
        ['ECT-0004', 'social', 'API', 'P2', 'LinkedIn post publish returned 429 Too Many Requests — rate limit hit', null, 'open'],
        ['ECT-0005', 'database', 'DB', 'P1', 'Slow query detected on campaign_lead table (>5000ms) — missing index on created_at', null, 'resolved'],
        ['ECT-0006', 'frontend', 'Runtime', 'P3', 'Hydration mismatch in /admin/analytics on date formatter locale', null, 'open'],
        ['ECT-0007', 'orders', 'TypeScript', 'P2', 'Type error in cart checkout: amount may be undefined before Stripe call', null, 'open'],
        ['ECT-0008', 'videos', 'Build', 'P3', 'Unused import warning in VideoWorkspace page — ffmpeg-static not imported', null, 'resolved'],
      ];
      for (const [error_id, module, error_type, severity, message, stack_trace, status] of seed) {
        await client.query(
          `INSERT INTO ect_errors (error_id, module, error_type, severity, message, stack_trace, status, resolved_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 = 'resolved' THEN NOW() - interval '2 hours' ELSE NULL END)
           ON CONFLICT (error_id) DO NOTHING`,
          [error_id, module, error_type, severity, message, stack_trace, status],
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  await ensureTables();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [errorsResult, healthResult] = await Promise.all([
      client.query(`SELECT * FROM ect_errors ORDER BY
        CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 200`),
      client.query(`SELECT * FROM ect_module_health ORDER BY
        CASE health_status WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
        module ASC`),
    ]);

    const errors = errorsResult.rows;
    const total = errors.length;
    const critical = errors.filter((e) => e.severity === 'P0').length;
    const open = errors.filter((e) => e.status === 'open').length;
    const resolved = errors.filter((e) => e.status === 'resolved').length;

    return Response.json({
      errors,
      module_health: healthResult.rows,
      summary: { total, critical, open, resolved },
      generated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  await ensureTables();

  const body = await req.json().catch(() => null);
  if (!body || !body.module || !body.error_type || !body.message) {
    return Response.json({ error: 'module, error_type, and message are required' }, { status: 400 });
  }

  const { module, error_type, severity = 'P2', message, stack_trace } = body;
  const error_id = `ECT-${Date.now()}`;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO ect_errors (error_id, module, error_type, severity, message, stack_trace, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *`,
      [error_id, module, error_type, severity, message, stack_trace ?? null],
    );

    // Update module health error count
    await client.query(
      `INSERT INTO ect_module_health (module, health_status, error_count, last_checked)
       VALUES ($1, 'warning', 1, NOW())
       ON CONFLICT (module) DO UPDATE
       SET error_count = ect_module_health.error_count + 1,
           health_status = CASE WHEN ect_module_health.error_count + 1 >= 5 THEN 'critical' ELSE 'warning' END,
           last_checked = NOW()`,
      [module],
    );

    return Response.json({ error: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.error_id || !body.status) {
    return Response.json({ error: 'error_id and status are required' }, { status: 400 });
  }

  const { error_id, status } = body;
  const validStatuses = ['open', 'investigating', 'resolved'];
  if (!validStatuses.includes(status)) {
    return Response.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE ect_errors
       SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
       WHERE error_id = $2
       RETURNING *`,
      [status, error_id],
    );

    if (result.rowCount === 0) {
      return Response.json({ error: 'Error not found' }, { status: 404 });
    }

    return Response.json({ error: result.rows[0] });
  } finally {
    client.release();
  }
}
