export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface SnapshotRow {
  id: number;
  competitor_id: number | null;
  competitor_name: string;
  portal_name: string;
  snapshot_type: string | null;
  data: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
}

// GET /api/admin/market-research/portal-snapshot?competitor=YogaWorks
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const competitor = searchParams.get('competitor');

  if (!competitor) {
    // Return distinct competitors with snapshot counts
    const result = await pool.query<{ competitor_name: string; snapshot_count: string }>(
      `SELECT competitor_name, COUNT(*) AS snapshot_count
       FROM competitor_portal_snapshot
       GROUP BY competitor_name
       ORDER BY competitor_name`,
    );
    return Response.json({ competitors: result.rows });
  }

  const result = await pool.query<SnapshotRow>(
    `SELECT * FROM competitor_portal_snapshot WHERE competitor_name = $1 ORDER BY fetched_at DESC`,
    [competitor],
  );

  return Response.json({ snapshots: result.rows });
}

// POST /api/admin/market-research/portal-snapshot
// body: { competitor_name: string; portal_name: string; snapshot_type: string; competitor_id?: number }
export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = (await req.json()) as {
    competitor_name?: string;
    portal_name?: string;
    snapshot_type?: string;
    competitor_id?: number;
  };

  const { competitor_name, portal_name, snapshot_type, competitor_id } = body;

  if (!competitor_name || !portal_name) {
    return Response.json({ error: 'competitor_name and portal_name required' }, { status: 400 });
  }

  // Simulate fetching data from the portal
  // In production: call the actual portal API using the configured api_key_env
  const simulatedData: Record<string, unknown> = {
    snapshot_type: snapshot_type ?? 'general',
    fetched_from: portal_name,
    competitor: competitor_name,
    timestamp: new Date().toISOString(),
    note: `Simulated snapshot. Wire real portal API by reading api_key_env from market_research_portal for "${portal_name}".`,
    metrics: {
      estimated_traffic: Math.floor(Math.random() * 500_000) + 50_000,
      estimated_keywords: Math.floor(Math.random() * 5000) + 500,
      backlinks: Math.floor(Math.random() * 100_000) + 10_000,
    },
  };

  const result = await pool.query<{ id: number }>(
    `INSERT INTO competitor_portal_snapshot (competitor_id, competitor_name, portal_name, snapshot_type, data, fetched_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [competitor_id ?? null, competitor_name, portal_name, snapshot_type ?? 'general', JSON.stringify(simulatedData)],
  );

  return Response.json({ ok: true, snapshotId: result.rows[0].id, data: simulatedData });
}
