export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS et_services (
        service_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'operational',
        uptime_pct NUMERIC(5,2) NOT NULL DEFAULT 99.90,
        cost_today_usd NUMERIC(8,2) NOT NULL DEFAULT 0,
        last_checked TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS et_incidents (
        id SERIAL PRIMARY KEY,
        severity VARCHAR(4) NOT NULL DEFAULT 'P2',
        service_id VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        declared_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS et_runbooks (
        runbook_id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        service_id VARCHAR(64) NOT NULL,
        steps JSONB NOT NULL DEFAULT '[]',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Pre-seed if empty
    const { rows: svcRows } = await client.query('SELECT COUNT(*) FROM et_services');
    if (parseInt(svcRows[0].count) === 0) {
      const services = [
        ['svc-frontend', 'Frontend (Next.js)', 'operational', 99.95, 12.40],
        ['svc-api', 'API Server (FastAPI)', 'operational', 99.91, 18.20],
        ['svc-db', 'PostgreSQL Database', 'operational', 99.99, 8.50],
        ['svc-auth', 'Auth Service', 'operational', 99.97, 3.10],
        ['svc-cron', 'Cron Scheduler', 'degraded', 98.50, 1.20],
        ['svc-email', 'Email (SMTP/SES)', 'operational', 99.80, 5.60],
        ['svc-social', 'Social Media API', 'operational', 99.70, 7.30],
        ['svc-analytics', 'Analytics Engine', 'operational', 99.85, 4.90],
        ['svc-ai', 'AI Engine (Ollama)', 'operational', 99.60, 22.10],
        ['svc-storage', 'Object Storage (S3)', 'operational', 99.99, 2.80],
      ];
      for (const [id, name, status, uptime, cost] of services) {
        await client.query(
          'INSERT INTO et_services (service_id, name, status, uptime_pct, cost_today_usd) VALUES ($1,$2,$3,$4,$5)',
          [id, name, status, uptime, cost]
        );
      }
    }

    const { rows: incRows } = await client.query('SELECT COUNT(*) FROM et_incidents');
    if (parseInt(incRows[0].count) === 0) {
      const incidents = [
        ['P1', 'svc-cron', 'Cron job scheduler missing heartbeat for 45 min — 3 jobs stalled', 'active'],
        ['P2', 'svc-ai', 'AI Engine inference latency > 8s (SLA 3s) — investigating GPU contention', 'active'],
        ['P3', 'svc-email', 'Email delivery delay ~12 min to Outlook domains — monitoring', 'active'],
      ];
      for (const [sev, sid, desc, status] of incidents) {
        await client.query(
          'INSERT INTO et_incidents (severity, service_id, description, status) VALUES ($1,$2,$3,$4)',
          [sev, sid, desc, status]
        );
      }
    }

    const { rows: rbRows } = await client.query('SELECT COUNT(*) FROM et_runbooks');
    if (parseInt(rbRows[0].count) === 0) {
      const runbooks = [
        ['rb-db-failover', 'Database Failover Procedure', 'svc-db', [
          'Verify primary DB is unresponsive via health check',
          'Promote read-replica to primary using pg_promote()',
          'Update DATABASE_URL in all services and restart',
          'Run data-integrity checks on promoted replica',
          'Notify on-call team and open incident ticket',
        ]],
        ['rb-cron-restart', 'Cron Scheduler Recovery', 'svc-cron', [
          'Check cron process status: pm2 status scheduler',
          'Inspect last heartbeat timestamp in cron_jobs table',
          'Kill stale node processes holding DB connections',
          'Restart scheduler: pm2 restart scheduler',
          'Verify first job run completes in next cycle',
        ]],
        ['rb-ai-latency', 'AI Engine High-Latency Resolution', 'svc-ai', [
          'Check GPU utilization: nvidia-smi',
          'Identify top memory-consuming Ollama processes',
          'Unload idle models: ollama stop <model>',
          'Reduce concurrent inference queue depth to 2',
          'Monitor latency for 5 min and confirm < 3s',
        ]],
        ['rb-auth-lockout', 'Auth Service User Lockout Recovery', 'svc-auth', [
          'Confirm auth service is responding at /api/auth/health',
          'Check JWT secret rotation — ensure env var matches',
          'Clear rate-limit Redis keys for affected users',
          'Force re-login for admin users',
        ]],
        ['rb-email-delay', 'Email Delivery SLA Breach', 'svc-email', [
          'Verify SMTP relay queue depth at provider dashboard',
          'Check SPF/DKIM/DMARC records for recent changes',
          'Switch to backup SMTP provider if queue > 500',
          'Re-queue failed emails from email_logs table',
          'Document issue in postmortem tracker',
        ]],
        ['rb-storage-full', 'Object Storage Capacity Warning', 'svc-storage', [
          'Run storage audit: list top 20 largest objects',
          'Archive objects older than 90 days to cold tier',
          'Delete temp/working files with status = processed',
          'Set up lifecycle rule for auto-archive after 60 days',
        ]],
      ];
      for (const [id, title, svcId, steps] of runbooks) {
        await client.query(
          'INSERT INTO et_runbooks (runbook_id, title, service_id, steps) VALUES ($1,$2,$3,$4)',
          [id, title, svcId, JSON.stringify(steps)]
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
  try {
    await ensureTables();
    const pool = getPool();
    const [svc, inc, rb] = await Promise.all([
      pool.query('SELECT * FROM et_services ORDER BY name'),
      pool.query("SELECT * FROM et_incidents ORDER BY declared_at DESC"),
      pool.query('SELECT * FROM et_runbooks ORDER BY title'),
    ]);
    const activeServices = svc.rows.filter(r => r.status === 'operational').length;
    const activeIncidents = inc.rows.filter(r => r.status === 'active').length;
    const slaCompliance = svc.rows.length
      ? (svc.rows.filter(r => parseFloat(r.uptime_pct) >= 99.9).length / svc.rows.length * 100).toFixed(1)
      : '0';
    const costToday = svc.rows.reduce((s, r) => s + parseFloat(r.cost_today_usd), 0).toFixed(2);
    return NextResponse.json({
      stats: { activeServices, activeIncidents, slaCompliance: parseFloat(slaCompliance), costToday: parseFloat(costToday) },
      services: svc.rows,
      incidents: inc.rows,
      runbooks: rb.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { severity: string; service_id: string; description: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'INSERT INTO et_incidents (severity, service_id, description, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [body.severity, body.service_id, body.description, 'active']
    );
    return NextResponse.json({ incident: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { id: number; status: string };
    const pool = getPool();
    const resolvedAt = body.status === 'resolved' ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      'UPDATE et_incidents SET status=$1, resolved_at=$2 WHERE id=$3 RETURNING *',
      [body.status, resolvedAt, body.id]
    );
    return NextResponse.json({ incident: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
