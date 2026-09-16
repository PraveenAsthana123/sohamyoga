export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ct_mr_alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        domain TEXT DEFAULT 'market-research',
        status TEXT DEFAULT 'open',
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ct_mr_alerts`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ct_mr_alerts (title, severity, message) VALUES
        ('Porter analysis data is stale — last run 14 days ago', 'warning', 'Schedule a new Porter Five Forces analysis for key verticals.'),
        ('Technology scout coverage gap in HealthTech vertical', 'info', '3 competitors added new AI features without scout coverage.'),
        ('Competitor pricing change detected', 'critical', 'Primary competitor dropped pricing by 15% this week.')
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [porterRes, scoutRes, alertRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS cnt, MAX(created_at) AS latest FROM porter_analyses`).catch(() => ({ rows: [{ cnt: 0, latest: null }] })),
      client.query(`SELECT COUNT(*)::int AS cnt, MAX(created_at) AS latest FROM technology_scouts`).catch(() => ({ rows: [{ cnt: 0, latest: null }] })),
      client.query(`SELECT * FROM ct_mr_alerts WHERE status='open' ORDER BY created_at DESC LIMIT 20`),
    ]);

    const porterCount = porterRes.rows[0]?.cnt ?? 0;
    const scoutCount = scoutRes.rows[0]?.cnt ?? 0;
    const porterLatest = porterRes.rows[0]?.latest;
    const scoutLatest = scoutRes.rows[0]?.latest;

    const daysSincePorter = porterLatest
      ? Math.floor((Date.now() - new Date(porterLatest).getTime()) / 86400000)
      : 999;
    const daysSinceScout = scoutLatest
      ? Math.floor((Date.now() - new Date(scoutLatest).getTime()) / 86400000)
      : 999;

    const porterScore = porterCount > 2 ? 33 : porterCount > 0 ? 20 : 0;
    const scoutScore = scoutCount > 5 ? 34 : scoutCount > 0 ? 20 : 0;
    const freshnessScore = daysSincePorter <= 7 && daysSinceScout <= 7 ? 33 : daysSincePorter <= 30 || daysSinceScout <= 30 ? 20 : 0;
    const health_score = Math.min(100, porterScore + scoutScore + freshnessScore);

    const porterRows = await client.query(`SELECT id, created_at, insights FROM porter_analyses ORDER BY created_at DESC LIMIT 5`).catch(() => ({ rows: [] }));
    const scoutRows = await client.query(`SELECT id, technology_name, description, created_at FROM technology_scouts ORDER BY created_at DESC LIMIT 10`).catch(() => ({ rows: [] }));

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Porter Analyses', value: porterCount, target: 3, trend: porterCount >= 3 ? 'up' : 'down', unit: 'total' },
        { label: 'Tech Scouts', value: scoutCount, target: 6, trend: scoutCount >= 6 ? 'up' : 'down', unit: 'total' },
        { label: 'Days Since Porter', value: daysSincePorter === 999 ? 'N/A' : daysSincePorter, target: 7, trend: daysSincePorter <= 7 ? 'up' : 'down', unit: 'days' },
        { label: 'Open Alerts', value: alertRes.rows.length, target: 0, trend: alertRes.rows.length === 0 ? 'up' : 'down', unit: 'alerts' },
      ],
      alerts: alertRes.rows,
      porter_analyses: porterRows.rows,
      tech_scouts: scoutRows.rows,
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
