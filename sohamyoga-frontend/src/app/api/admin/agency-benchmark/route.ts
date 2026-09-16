import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BENCHMARK_DATA = {
  agency: {
    client_retention_rate: 87,
    avg_campaign_roi: 3.4,
    avg_time_to_launch_days: 8,
    client_satisfaction_score: 4.2,
    mrr_growth_percent: 12,
    avg_retainer_cad: 2800,
  },
  industry_avg: {
    client_retention_rate: 72,
    avg_campaign_roi: 2.8,
    avg_time_to_launch_days: 14,
    client_satisfaction_score: 3.8,
    mrr_growth_percent: 8,
    avg_retainer_cad: 2200,
  },
  top_quartile: {
    client_retention_rate: 92,
    avg_campaign_roi: 5.1,
    avg_time_to_launch_days: 5,
    client_satisfaction_score: 4.7,
    mrr_growth_percent: 25,
    avg_retainer_cad: 4500,
  },
};

// 6-month seeded trend history
const TREND_DATA = [
  { month: '2026-04', client_retention_rate: 81, avg_campaign_roi: 2.9, avg_time_to_launch_days: 12, client_satisfaction_score: 3.9, mrr_growth_percent: 7, avg_retainer_cad: 2400 },
  { month: '2026-05', client_retention_rate: 82, avg_campaign_roi: 3.0, avg_time_to_launch_days: 11, client_satisfaction_score: 4.0, mrr_growth_percent: 8, avg_retainer_cad: 2500 },
  { month: '2026-06', client_retention_rate: 84, avg_campaign_roi: 3.1, avg_time_to_launch_days: 10, client_satisfaction_score: 4.0, mrr_growth_percent: 9, avg_retainer_cad: 2550 },
  { month: '2026-07', client_retention_rate: 85, avg_campaign_roi: 3.2, avg_time_to_launch_days: 9, client_satisfaction_score: 4.1, mrr_growth_percent: 10, avg_retainer_cad: 2650 },
  { month: '2026-08', client_retention_rate: 86, avg_campaign_roi: 3.3, avg_time_to_launch_days: 9, client_satisfaction_score: 4.1, mrr_growth_percent: 11, avg_retainer_cad: 2720 },
  { month: '2026-09', client_retention_rate: 87, avg_campaign_roi: 3.4, avg_time_to_launch_days: 8, client_satisfaction_score: 4.2, mrr_growth_percent: 12, avg_retainer_cad: 2800 },
];

async function ensureTable(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agency_benchmark_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        snapshot_date DATE NOT NULL,
        metrics_json JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM agency_benchmark_snapshots`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(
        `INSERT INTO agency_benchmark_snapshots (snapshot_date, metrics_json)
         VALUES ($1, $2)`,
        ['2026-09-16', JSON.stringify(BENCHMARK_DATA)]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    // Store a fresh snapshot if none for today
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id FROM agency_benchmark_snapshots WHERE snapshot_date = CURRENT_DATE`
      );
      if (!rows.length) {
        await client.query(
          `INSERT INTO agency_benchmark_snapshots (snapshot_date, metrics_json) VALUES (CURRENT_DATE, $1)`,
          [JSON.stringify(BENCHMARK_DATA)]
        );
      }
    } finally {
      client.release();
    }
    return Response.json({ ...BENCHMARK_DATA, trends: TREND_DATA });
  } catch (err) {
    console.error('agency-benchmark GET error:', err);
    return Response.json({ error: 'Failed to fetch benchmark data.' }, { status: 500 });
  }
}
