export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

// ---------------------------------------------------------------------------
// GET /api/admin/rag/status — RAG system health check
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({
      pgvector_installed: false,
      embedding_model_available: false,
      document_count: 0,
      chunk_count: 0,
      query_count: 0,
      ready: false,
      error: 'Database not configured.',
    });
  }

  let pgvectorInstalled = false;
  let documentCount = 0;
  let chunkCount = 0;
  let queryCount = 0;

  const client = await getPool().connect();
  try {
    // Check pgvector extension
    const extRes = await client.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    );
    pgvectorInstalled = extRes.rows.length > 0;

    // Count documents, chunks, queries (tables may not exist yet)
    try {
      const docRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM rag_documents`,
      );
      documentCount = parseInt(docRes.rows[0]?.count ?? '0', 10);

      const chunkRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM rag_chunks`,
      );
      chunkCount = parseInt(chunkRes.rows[0]?.count ?? '0', 10);

      const qRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM rag_queries`,
      );
      queryCount = parseInt(qRes.rows[0]?.count ?? '0', 10);
    } catch {
      // Tables may not be initialized yet — counts stay at 0
    }
  } catch (err) {
    console.error('[RAG status] DB error:', err);
  } finally {
    client.release();
  }

  // Check Ollama + nomic-embed-text availability
  let embeddingModelAvailable = false;
  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json() as { models?: Array<{ name: string }> };
      const models = data.models ?? [];
      embeddingModelAvailable = models.some(
        (m) => m.name.startsWith('nomic-embed-text'),
      );
    }
  } catch {
    // Ollama not reachable
  }

  const ready = pgvectorInstalled && embeddingModelAvailable && documentCount > 0;

  return Response.json({
    pgvector_installed: pgvectorInstalled,
    embedding_model_available: embeddingModelAvailable,
    document_count: documentCount,
    chunk_count: chunkCount,
    query_count: queryCount,
    ready,
    ollama_base: OLLAMA_BASE,
  });
}
