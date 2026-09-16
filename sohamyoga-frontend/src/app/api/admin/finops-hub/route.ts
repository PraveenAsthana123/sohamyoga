export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS cloud_costs (
    id SERIAL PRIMARY KEY, provider TEXT, service_name TEXT, month TEXT,
    cost_usd NUMERIC DEFAULT 0, budget_usd NUMERIC DEFAULT 0, tags JSONB,
    anomaly BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS cost_optimization_actions (
    id SERIAL PRIMARY KEY, title TEXT, service TEXT, action_type TEXT,
    estimated_savings NUMERIC DEFAULT 0, effort TEXT DEFAULT 'low',
    status TEXT DEFAULT 'recommended', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS security_controls (
    id SERIAL PRIMARY KEY, control_name TEXT, category TEXT, status TEXT DEFAULT 'compliant',
    last_checked DATE, evidence TEXT, risk_if_missing TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS vulnerability_findings (
    id SERIAL PRIMARY KEY, title TEXT, severity TEXT DEFAULT 'medium', cve_id TEXT,
    affected_system TEXT, status TEXT DEFAULT 'open', remediation TEXT,
    discovered_at DATE DEFAULT CURRENT_DATE, resolved_at DATE
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM cloud_costs');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO cloud_costs (provider, service_name, month, cost_usd, budget_usd, tags, anomaly) VALUES
      ('AWS','EC2 Instances','2026-07',342.50,300.00,'{"env":"production","team":"backend"}',true),
      ('AWS','RDS PostgreSQL','2026-07',89.20,100.00,'{"env":"production"}',false),
      ('AWS','S3 Storage','2026-07',23.40,30.00,'{"env":"all"}',false),
      ('Vercel','Next.js Hosting','2026-07',45.00,50.00,'{"env":"production","service":"frontend"}',false),
      ('Vercel','Next.js Hosting','2026-08',47.50,50.00,'{"env":"production","service":"frontend"}',false),
      ('AWS','EC2 Instances','2026-08',289.00,300.00,'{"env":"production","team":"backend"}',false),
      ('AWS','RDS PostgreSQL','2026-08',91.80,100.00,'{"env":"production"}',false),
      ('Google Cloud','BigQuery Analytics','2026-08',156.00,120.00,'{"env":"analytics"}',true)
    `);
    await client.query(`INSERT INTO cost_optimization_actions (title, service, action_type, estimated_savings, effort, status) VALUES
      ('Right-size EC2 t3.large to t3.medium','AWS EC2','right-sizing',87.00,'low','recommended'),
      ('Enable S3 Intelligent Tiering','AWS S3','storage-optimization',12.50,'low','in_progress'),
      ('Reserve EC2 instances (1-year)','AWS EC2','reserved-instances',102.00,'medium','recommended'),
      ('Consolidate RDS read replicas','AWS RDS','architecture-optimization',45.00,'medium','recommended'),
      ('Migrate BigQuery to scheduled queries','Google Cloud BigQuery','cost-control',78.00,'high','recommended')
    `);
    await client.query(`INSERT INTO security_controls (control_name, category, status, last_checked, evidence, risk_if_missing) VALUES
      ('MFA Enabled — All Admin Users','Identity & Access','compliant','2026-09-01','Verified via admin panel — 100% MFA adoption','Account takeover risk'),
      ('Database Encryption at Rest','Data Protection','compliant','2026-09-01','RDS encryption enabled, verified in AWS console','Regulatory non-compliance, data breach'),
      ('TLS 1.3 — All API Endpoints','Transport Security','compliant','2026-09-10','SSL Labs scan A+ rating','Data interception'),
      ('WAF — Web Application Firewall','Network Security','partial','2026-09-05','AWS WAF enabled but rules need tuning — 3 critical rules missing','SQL injection, XSS attacks'),
      ('GDPR/PIPEDA Data Retention Policy','Compliance','non_compliant','2026-09-01','Policy document exists but automated deletion not implemented','Regulatory fine up to 4% revenue'),
      ('Secrets Management — No Hardcoded Keys','Code Security','compliant','2026-09-12','GitHub secret scanning enabled, 0 findings in last 30 days','API key exposure')
    `);
    await client.query(`INSERT INTO vulnerability_findings (title, severity, cve_id, affected_system, status, remediation, discovered_at) VALUES
      ('Next.js 14.x - SSRF in Image Optimization','high','CVE-2024-34351','sohamyoga-frontend (Next.js)','open','Upgrade to Next.js 14.2.4+','2026-09-10'),
      ('Outdated PostgreSQL 14 — Missing Security Patches','medium',NULL,'RDS PostgreSQL','in_remediation','Upgrade to PostgreSQL 16 via RDS upgrade wizard','2026-09-05'),
      ('bcrypt Rounds Below Industry Standard','medium',NULL,'Authentication Service','open','Increase bcrypt work factor from 10 to 14','2026-09-12'),
      ('CORS Misconfiguration — Wildcard Origin Allowed','high',NULL,'API Gateway','resolved','Restricted CORS to known domains. Deployed 2026-09-08.','2026-08-28')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const [costs, stats] = await Promise.all([
      client.query('SELECT * FROM cloud_costs ORDER BY month DESC, cost_usd DESC'),
      client.query(`SELECT COALESCE(SUM(cost_usd),0) as total_spend, COALESCE(SUM(budget_usd),0) as total_budget,
        COALESCE(SUM(cost_usd) FILTER (WHERE anomaly),0) as anomaly_spend,
        COUNT(*) FILTER (WHERE anomaly) as anomaly_count FROM cloud_costs`),
    ]);
    return Response.json({ costs: costs.rows, stats: stats.rows[0] });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `INSERT INTO cloud_costs (provider, service_name, month, cost_usd, budget_usd, tags, anomaly)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.provider, body.service_name, body.month, body.cost_usd || 0, body.budget_usd || 0, JSON.stringify(body.tags || {}), body.anomaly || false]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
