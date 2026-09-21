export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS genai_usecase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usecase_name TEXT NOT NULL,
    model_preference TEXT,
    rag_required BOOLEAN DEFAULT false,
    estimated_cost_monthly NUMERIC,
    expected_roi NUMERIC,
    implementation_status TEXT DEFAULT 'evaluating',
    priority TEXT DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS genai_model_eval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usecase_id UUID REFERENCES genai_usecase(id) ON DELETE CASCADE,
    model_name TEXT,
    provider TEXT,
    accuracy_score NUMERIC,
    cost_per_1k_tokens NUMERIC,
    latency_ms INT,
    selected BOOLEAN DEFAULT false,
    evaluated_at DATE,
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
    const items = await query(`SELECT * FROM genai_usecase ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM genai_model_eval ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO genai_usecase (usecase_name, model_preference, estimated_cost_monthly, expected_roi) VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.usecase_name ?? null, body.model_preference ?? null, body.estimated_cost_monthly ?? null, body.expected_roi ?? null]
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
    await query(`DELETE FROM genai_usecase WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
