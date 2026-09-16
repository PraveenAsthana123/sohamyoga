import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS vector_document (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    source_type TEXT DEFAULT 'manual',
    source_ref TEXT,
    content_preview TEXT,
    chunk_count INTEGER DEFAULT 0,
    embedding_model TEXT DEFAULT 'nomic-embed-text',
    embedding_status TEXT DEFAULT 'pending',
    vector_collection TEXT DEFAULT 'default',
    last_indexed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const collection = searchParams.get('collection');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`embedding_status = $${idx++}`); values.push(status); }
  if (collection) { conditions.push(`vector_collection = $${idx++}`); values.push(collection); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM vector_document ${where} ORDER BY created_at DESC`,
    values
  );
  return Response.json({ documents: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.title) return Response.json({ error: 'title is required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO vector_document (title, source_type, source_ref, content_preview, embedding_model, vector_collection, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.title, b.source_type || 'manual', b.source_ref || null, b.content_preview || null,
     b.embedding_model || 'nomic-embed-text', b.vector_collection || 'default',
     JSON.stringify(b.metadata || {})]
  );
  return Response.json({ document: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.id) return Response.json({ error: 'id is required' }, { status: 400 });
  const fields = ['title','source_type','source_ref','content_preview','chunk_count',
    'embedding_model','embedding_status','vector_collection','last_indexed_at','metadata'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const f of fields) {
    if (f in b) {
      setClauses.push(`${f} = $${idx++}`);
      values.push(f === 'metadata' ? JSON.stringify(b[f]) : b[f]);
    }
  }
  if (!setClauses.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  values.push(b.id);
  const { rows } = await pool.query(
    `UPDATE vector_document SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ document: rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await pool.query(`DELETE FROM vector_document WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
