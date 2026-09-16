import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pool = getPool();

async function ensureTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS growth_experiment (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      channel TEXT,
      growth_lever TEXT,
      status TEXT DEFAULT 'idea',
      start_date DATE,
      end_date DATE,
      metric_primary TEXT,
      baseline_value NUMERIC,
      target_value NUMERIC,
      actual_value NUMERIC,
      lift_pct NUMERIC,
      investment_usd NUMERIC DEFAULT 0,
      roi_pct NUMERIC,
      notes TEXT,
      learnings TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS growth_metric_snapshot (
      id SERIAL PRIMARY KEY,
      metric_name TEXT NOT NULL,
      value NUMERIC NOT NULL,
      recorded_at DATE DEFAULT CURRENT_DATE,
      source TEXT DEFAULT 'manual'
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await ensureTables(client);

    const [experiments, latestMetrics, aarrr] = await Promise.all([
      client.query('SELECT * FROM growth_experiment ORDER BY created_at DESC').catch(() => ({ rows: [] })),
      client.query(`
        SELECT DISTINCT ON (metric_name) metric_name, value, recorded_at, source
        FROM growth_metric_snapshot
        ORDER BY metric_name, recorded_at DESC
      `).catch(() => ({ rows: [] })),
      Promise.all([
        // Acquisition: pageview visitors
        client.query(`SELECT COUNT(*) AS count FROM customer_event WHERE event_type = 'pageview'`).catch(() => ({ rows: [{ count: 0 }] })),
        // New signups
        client.query(`SELECT COUNT(*) AS count FROM customer WHERE created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ count: 0 }] })),
        // Activation: onboarding complete
        client.query(`SELECT COUNT(DISTINCT customer_id) AS count FROM customer_event WHERE event_type = 'onboarding_complete'`).catch(() => ({ rows: [{ count: 0 }] })),
        // Retention: active last 30d
        client.query(`SELECT COUNT(DISTINCT customer_id) AS count FROM customer_event WHERE created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ count: 0 }] })),
        // Referral signups
        client.query(`SELECT COUNT(*) AS count FROM customer WHERE referral_code IS NOT NULL`).catch(() => ({ rows: [{ count: 0 }] })),
        // Revenue: MRR from sales_order
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS mrr FROM sales_order WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'completed'`).catch(() => ({ rows: [{ mrr: 0 }] })),
      ]),
    ]);

    const [visitors, signups, activated, retained, referrals, revenue] = aarrr;

    return Response.json({
      experiments: experiments.rows,
      latestMetrics: latestMetrics.rows,
      aarrr: {
        acquisition: { visitors: Number(visitors.rows[0]?.count ?? 0), newSignups: Number(signups.rows[0]?.count ?? 0) },
        activation: { count: Number(activated.rows[0]?.count ?? 0) },
        retention: { activeCount: Number(retained.rows[0]?.count ?? 0) },
        referral: { count: Number(referrals.rows[0]?.count ?? 0) },
        revenue: { mrr: Number((revenue.rows[0] as Record<string, unknown>)?.mrr ?? 0) },
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Request body required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await ensureTables(client);

    // Handle metric snapshot insert
    if (body.action === 'metric_snapshot') {
      if (!body.metric_name || body.value === undefined) {
        return Response.json({ error: 'metric_name and value are required.' }, { status: 400 });
      }
      const result = await client.query(
        `INSERT INTO growth_metric_snapshot (metric_name, value, source)
         VALUES ($1, $2, $3) RETURNING *`,
        [body.metric_name, Number(body.value), body.source ?? 'manual']
      );
      return Response.json({ snapshot: result.rows[0] }, { status: 201 });
    }

    // Create experiment
    if (!body.name || !body.hypothesis) {
      return Response.json({ error: 'name and hypothesis are required.' }, { status: 400 });
    }
    const result = await client.query(
      `INSERT INTO growth_experiment
        (name, hypothesis, channel, growth_lever, status, start_date, end_date,
         metric_primary, baseline_value, target_value, investment_usd, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        body.name, body.hypothesis, body.channel ?? null, body.growth_lever ?? null,
        body.status ?? 'idea', body.start_date ?? null, body.end_date ?? null,
        body.metric_primary ?? null, body.baseline_value ?? null, body.target_value ?? null,
        Number(body.investment_usd ?? 0), body.notes ?? null,
      ]
    );
    return Response.json({ experiment: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.id) return Response.json({ error: 'id is required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await ensureTables(client);

    // Auto-compute lift_pct and roi_pct
    let liftPct: number | null = null;
    let roiPct: number | null = null;

    if (body.actual_value !== undefined && body.baseline_value !== undefined) {
      const baseline = Number(body.baseline_value);
      const actual = Number(body.actual_value);
      liftPct = baseline !== 0 ? ((actual - baseline) / baseline) * 100 : null;
    }
    if (body.investment_usd !== undefined && body.revenue_generated !== undefined) {
      const inv = Number(body.investment_usd);
      const rev = Number(body.revenue_generated);
      roiPct = inv !== 0 ? ((rev - inv) / inv) * 100 : null;
    }

    const result = await client.query(
      `UPDATE growth_experiment SET
        status = COALESCE($2, status),
        actual_value = COALESCE($3, actual_value),
        learnings = COALESCE($4, learnings),
        lift_pct = COALESCE($5, lift_pct),
        roi_pct = COALESCE($6, roi_pct),
        notes = COALESCE($7, notes)
       WHERE id = $1 RETURNING *`,
      [body.id, body.status ?? null, body.actual_value ?? null, body.learnings ?? null, liftPct, roiPct, body.notes ?? null]
    );
    if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ experiment: result.rows[0] });
  } finally {
    client.release();
  }
}
