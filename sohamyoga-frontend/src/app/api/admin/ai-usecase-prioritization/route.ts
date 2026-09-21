export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS ai_usecase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usecase_name TEXT NOT NULL,
    description TEXT,
    business_area TEXT,
    impact_score INT DEFAULT 5,
    feasibility_score INT DEFAULT 5,
    cost_estimate NUMERIC,
    time_to_value_weeks INT,
    status TEXT DEFAULT 'candidate',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS usecase_vote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usecase_id UUID REFERENCES ai_usecase(id) ON DELETE CASCADE,
    voter TEXT,
    impact_vote INT DEFAULT 5,
    feasibility_vote INT DEFAULT 5,
    notes TEXT,
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
    const items = await query(`SELECT * FROM ai_usecase ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM usecase_vote ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO ai_usecase (usecase_name, description, business_area, cost_estimate, time_to_value_weeks) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.usecase_name ?? null, body.description ?? null, body.business_area ?? null, body.cost_estimate ?? null, body.time_to_value_weeks ?? null]
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
    await query(`DELETE FROM ai_usecase WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
