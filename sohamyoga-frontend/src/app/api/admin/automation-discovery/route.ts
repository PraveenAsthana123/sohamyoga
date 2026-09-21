export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS automation_candidate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name TEXT NOT NULL,
    department TEXT,
    frequency TEXT,
    manual_hours_weekly NUMERIC,
    error_rate_pct NUMERIC,
    complexity TEXT DEFAULT 'medium',
    automation_type TEXT DEFAULT 'rpa',
    estimated_roi NUMERIC,
    payback_months INT,
    priority_score NUMERIC,
    status TEXT DEFAULT 'candidate',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS automation_assessment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES automation_candidate(id) ON DELETE CASCADE,
    assessor TEXT,
    notes TEXT,
    score INT DEFAULT 0,
    recommendation TEXT,
    assessed_at DATE DEFAULT CURRENT_DATE,
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
    const items = await query(`SELECT * FROM automation_candidate ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM automation_assessment ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO automation_candidate (process_name, department, frequency, manual_hours_weekly, error_rate_pct, estimated_roi, payback_months, priority_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.process_name ?? null, body.department ?? null, body.frequency ?? null, body.manual_hours_weekly ?? null, body.error_rate_pct ?? null, body.estimated_roi ?? null, body.payback_months ?? null, body.priority_score ?? null]
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
    await query(`DELETE FROM automation_candidate WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
