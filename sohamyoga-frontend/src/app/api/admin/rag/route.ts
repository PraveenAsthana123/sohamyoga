export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema, ingestDocument, seedDemoDocuments } from '@/lib/rag';

// ---------------------------------------------------------------------------
// GET /api/admin/rag — list all documents
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    await ensureRagSchema();

    const client = await getPool().connect();
    try {
      const res = await client.query<{
        id: number;
        source_id: string;
        source_type: string;
        title: string;
        content_length: number;
        chunk_count: number;
        status: string;
        created_at: string;
      }>(`SELECT id, source_id, source_type, title, content_length, chunk_count, status, created_at
          FROM rag_documents ORDER BY created_at DESC`);
      return Response.json({ documents: res.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[RAG GET] error:', err);
    return Response.json({ error: 'Failed to list documents.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/rag — ingest a new document (+ seed demo docs on first use)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    await ensureRagSchema();

    // Seed demo documents on first call (idempotent)
    await seedDemoDocuments();

    const body = await req.json() as {
      title?: string;
      content?: string;
      source_type?: string;
      source_id?: string;
    };

    const { title, content, source_type = 'text', source_id } = body;

    if (!title || !content) {
      return Response.json({ error: 'title and content are required.' }, { status: 400 });
    }

    const finalSourceId = source_id ?? `manual-${Date.now()}`;

    const { chunks_stored } = await ingestDocument({
      source_id: finalSourceId,
      source_type,
      title,
      content,
    });

    // Return the created document record
    const client = await getPool().connect();
    try {
      const docRes = await client.query<{ id: number }>(
        `SELECT id FROM rag_documents WHERE source_id = $1`,
        [finalSourceId],
      );
      return Response.json({ id: docRes.rows[0]?.id, chunks_stored }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[RAG POST] error:', err);
    return Response.json({ error: 'Failed to ingest document.' }, { status: 500 });
  }
}
