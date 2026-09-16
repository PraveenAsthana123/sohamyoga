import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS ab_test (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    page_path TEXT,
    hypothesis TEXT,
    traffic_split INTEGER DEFAULT 50,
    start_date DATE,
    end_date DATE,
    metric_primary TEXT,
    variant_a_name TEXT DEFAULT 'Control',
    variant_b_name TEXT DEFAULT 'Variant',
    variant_a_views INTEGER DEFAULT 0,
    variant_a_conversions INTEGER DEFAULT 0,
    variant_b_views INTEGER DEFAULT 0,
    variant_b_conversions INTEGER DEFAULT 0,
    winner TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

function computeStats(row: {
  variant_a_views: number;
  variant_a_conversions: number;
  variant_b_views: number;
  variant_b_conversions: number;
}) {
  const cvrA = row.variant_a_views > 0 ? row.variant_a_conversions / row.variant_a_views : 0;
  const cvrB = row.variant_b_views > 0 ? row.variant_b_conversions / row.variant_b_views : 0;
  const maxCvr = Math.max(cvrA, cvrB);
  const liftPct = maxCvr > 0 ? Math.abs(cvrA - cvrB) / maxCvr * 100 : 0;
  return { cvr_a: cvrA, cvr_b: cvrB, lift_pct: Math.round(liftPct * 10) / 10 };
}

async function ensureTable() {
  await query(ENSURE_TABLE);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTable();

  const result = await query(
    `SELECT id, name, description, status, page_path, hypothesis, traffic_split,
            start_date, end_date, metric_primary,
            variant_a_name, variant_b_name,
            variant_a_views, variant_a_conversions,
            variant_b_views, variant_b_conversions,
            winner, created_at
     FROM ab_test ORDER BY created_at DESC`,
  ).catch(() => ({ rows: [] }));

  const tests = result.rows.map(r => ({
    ...r,
    ...computeStats({
      variant_a_views: Number(r.variant_a_views),
      variant_a_conversions: Number(r.variant_a_conversions),
      variant_b_views: Number(r.variant_b_views),
      variant_b_conversions: Number(r.variant_b_conversions),
    }),
  }));

  return Response.json({ tests });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTable();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const {
    name, description, page_path, hypothesis,
    traffic_split = 50, start_date, end_date, metric_primary,
    variant_a_name = 'Control', variant_b_name = 'Variant',
  } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'name is required.' }, { status: 400 });
  }

  const splitNum = typeof traffic_split === 'number' ? Math.round(traffic_split) : 50;
  if (splitNum < 1 || splitNum > 99) {
    return Response.json({ error: 'traffic_split must be between 1 and 99.' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO ab_test (name, description, status, page_path, hypothesis, traffic_split,
                          start_date, end_date, metric_primary, variant_a_name, variant_b_name)
     VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      name.trim(),
      typeof description === 'string' ? description : null,
      typeof page_path === 'string' ? page_path : null,
      typeof hypothesis === 'string' ? hypothesis : null,
      splitNum,
      start_date || null,
      end_date || null,
      typeof metric_primary === 'string' ? metric_primary : null,
      typeof variant_a_name === 'string' ? variant_a_name : 'Control',
      typeof variant_b_name === 'string' ? variant_b_name : 'Variant',
    ],
  ).catch(() => ({ rows: [] }));

  if (!result.rows.length) return Response.json({ error: 'Failed to create test.' }, { status: 500 });
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTable();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const { id, status } = body as Record<string, unknown>;
  const VALID_STATUSES = ['draft', 'running', 'paused', 'completed'];

  if (!id || typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
    return Response.json({ error: `id and status (${VALID_STATUSES.join('|')}) are required.` }, { status: 400 });
  }

  const result = await query(
    `UPDATE ab_test SET status = $1 WHERE id = $2 RETURNING id`,
    [status, Number(id)],
  ).catch(() => ({ rows: [] }));

  if (!result.rows.length) return Response.json({ error: 'Test not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
