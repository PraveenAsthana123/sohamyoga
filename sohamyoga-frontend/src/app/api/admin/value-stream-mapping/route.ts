export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS vsm_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_family TEXT NOT NULL,
    current_state_lead_days NUMERIC,
    future_state_lead_days NUMERIC,
    value_added_time_mins NUMERIC,
    non_value_added_time_mins NUMERIC,
    owner TEXT,
    status TEXT DEFAULT 'current',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS vsm_step (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID REFERENCES vsm_map(id) ON DELETE CASCADE,
    step_name TEXT,
    step_type TEXT DEFAULT 'process',
    cycle_time_mins NUMERIC,
    uptime_pct NUMERIC,
    inventory_units INT DEFAULT 0,
    order_seq INT DEFAULT 1,
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
    const items = await query(`SELECT * FROM vsm_map ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM vsm_step ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO vsm_map (product_family, current_state_lead_days, future_state_lead_days, value_added_time_mins, non_value_added_time_mins, owner) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.product_family ?? null, body.current_state_lead_days ?? null, body.future_state_lead_days ?? null, body.value_added_time_mins ?? null, body.non_value_added_time_mins ?? null, body.owner ?? null]
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
    await query(`DELETE FROM vsm_map WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
