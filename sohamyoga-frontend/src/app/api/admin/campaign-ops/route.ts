import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ campaigns: [], stageLogs: [], summary: { totalCampaigns: 0, totalBudget: 0, totalRevenue: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_op (
        id SERIAL PRIMARY KEY,
        campaign_name TEXT NOT NULL,
        channel TEXT,
        objective TEXT,
        budget NUMERIC(10,2) DEFAULT 0,
        start_date DATE,
        end_date DATE,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue_attributed NUMERIC(10,2) DEFAULT 0,
        cost_per_order NUMERIC(10,2) DEFAULT 0,
        status TEXT DEFAULT 'idea',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_stage_log (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaign_op(id) ON DELETE CASCADE,
        stage TEXT,
        notes TEXT,
        changed_by TEXT,
        changed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [campaignsRes, stageLogsRes] = await Promise.all([
      client.query(`SELECT * FROM campaign_op ORDER BY created_at DESC LIMIT 200`).catch(() => ({ rows: [] })),
      client.query(`SELECT csl.*, co.campaign_name FROM campaign_stage_log csl LEFT JOIN campaign_op co ON co.id = csl.campaign_id ORDER BY csl.changed_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const campaigns: Array<{ budget: number; revenue_attributed: number }> = campaignsRes.rows;
    const summary = {
      totalCampaigns: campaigns.length,
      totalBudget: campaigns.reduce((s, c) => s + Number(c.budget ?? 0), 0),
      totalRevenue: campaigns.reduce((s, c) => s + Number(c.revenue_attributed ?? 0), 0),
    };

    return Response.json({ campaigns: campaignsRes.rows, stageLogs: stageLogsRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'advance_stage' && body.campaign_id) {
      const stages = ['idea', 'draft', 'approved', 'scheduled', 'activated', 'observed', 'attributed', 'evaluated'];
      const res = await client.query(`SELECT status FROM campaign_op WHERE id = $1`, [body.campaign_id]);
      if (res.rows[0]) {
        const idx = stages.indexOf(res.rows[0].status);
        const next = stages[Math.min(idx + 1, stages.length - 1)];
        await client.query(`UPDATE campaign_op SET status = $1 WHERE id = $2`, [next, body.campaign_id]);
        await client.query(`INSERT INTO campaign_stage_log (campaign_id, stage, changed_by) VALUES ($1,$2,$3)`, [body.campaign_id, next, body.changed_by ?? 'admin']);
        return Response.json({ ok: true, newStatus: next });
      }
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const result = await client.query(
      `INSERT INTO campaign_op (campaign_name, channel, objective, budget, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.campaign_name ?? '', body.channel ?? '', body.objective ?? '', body.budget ?? 0, body.start_date ?? null, body.end_date ?? null, body.status ?? 'idea']
    );
    await client.query(`INSERT INTO campaign_stage_log (campaign_id, stage, changed_by) VALUES ($1,$2,$3)`, [result.rows[0].id, 'idea', 'admin']);
    return Response.json({ campaign: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
