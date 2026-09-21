export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS idp_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name TEXT NOT NULL,
    document_type TEXT,
    source TEXT DEFAULT 'email',
    model TEXT DEFAULT 'llama3.2',
    fields_extracted TEXT[],
    accuracy_pct NUMERIC DEFAULT 0,
    docs_processed_today INT DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS idp_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES idp_pipeline(id) ON DELETE CASCADE,
    doc_name TEXT,
    extracted_data JSONB DEFAULT '{}',
    confidence_avg NUMERIC,
    reviewed BOOLEAN DEFAULT false,
    reviewer TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
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
    const items = await query(`SELECT * FROM idp_pipeline ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM idp_document ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO idp_pipeline (pipeline_name, document_type, fields_extracted) VALUES ($1, $2, $3) RETURNING *`,
      [body.pipeline_name ?? null, body.document_type ?? null, body.fields_extracted ?? null]
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
    await query(`DELETE FROM idp_pipeline WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
