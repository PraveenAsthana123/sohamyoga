export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS demand_campaign (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name TEXT NOT NULL,
    channel TEXT,
    tactic TEXT,
    budget NUMERIC DEFAULT 0,
    impressions INT DEFAULT 0,
    leads_generated INT DEFAULT 0,
    mqls INT DEFAULT 0,
    sqls INT DEFAULT 0,
    cost_per_lead NUMERIC,
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS demand_asset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES demand_campaign(id) ON DELETE CASCADE,
    asset_name TEXT,
    asset_type TEXT,
    downloads INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({ items: [], children: [] });
  try {
    await ensureSchema();
    const items = await query(`SELECT * FROM demand_campaign ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM demand_asset ORDER BY created_at DESC LIMIT 500`);
    return Response.json({ items: items.rows, children: children.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const result = await query(
      `INSERT INTO demand_campaign (campaign_name, channel, tactic, cost_per_lead, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.campaign_name ?? null, body.channel ?? null, body.tactic ?? null, body.cost_per_lead ?? null, body.start_date ?? null, body.end_date ?? null]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({error: 'id required'}, {status: 400});
    await query(`DELETE FROM demand_campaign WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
