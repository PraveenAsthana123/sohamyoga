export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema } from '@/lib/rag';

// ---------------------------------------------------------------------------
// GET /api/admin/rag/[id] — single document detail
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await ensureRagSchema();
    const client = await getPool().connect();
    try {
      const docRes = await client.query<{
        id: number;
        source_id: string;
        source_type: string;
        title: string;
        content_length: number;
        chunk_count: number;
        status: string;
        created_at: string;
      }>(
        `SELECT id, source_id, source_type, title, content_length, chunk_count, status, created_at
         FROM rag_documents WHERE id = $1`,
        [docId],
      );

      if (docRes.rows.length === 0) {
        return Response.json({ error: 'Document not found.' }, { status: 404 });
      }

      const chunkRes = await client.query<{ chunk_index: number; chunk_text: string }>(
        `SELECT chunk_index, chunk_text FROM rag_chunks WHERE document_id = $1 ORDER BY chunk_index`,
        [docId],
      );

      return Response.json({ document: docRes.rows[0], chunks: chunkRes.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[RAG GET/:id] error:', err);
    return Response.json({ error: 'Failed to fetch document.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/rag/[id] — delete document + all its chunks
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await ensureRagSchema();
    const client = await getPool().connect();
    try {
      const res = await client.query(
        `DELETE FROM rag_documents WHERE id = $1 RETURNING id`,
        [docId],
      );
      if (res.rowCount === 0) {
        return Response.json({ error: 'Document not found.' }, { status: 404 });
      }
      return Response.json({ deleted: true, id: docId });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[RAG DELETE/:id] error:', err);
    return Response.json({ error: 'Failed to delete document.' }, { status: 500 });
  }
}
