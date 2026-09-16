export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema, retrieveRelevant, ragGenerate } from '@/lib/rag';

// ---------------------------------------------------------------------------
// POST /api/admin/rag/ask — full RAG pipeline: retrieve + generate
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    await ensureRagSchema();

    const body = await req.json() as {
      question?: string;
      system_prompt?: string;
    };

    const { question, system_prompt } = body;

    if (!question || question.trim().length === 0) {
      return Response.json({ error: 'question is required.' }, { status: 400 });
    }

    const startMs = Date.now();

    // Step 1 — retrieve relevant chunks via vector similarity
    const chunks = await retrieveRelevant({ query: question, limit: 5, similarity_threshold: 0.5 });

    // Step 2 — generate answer grounded in retrieved context
    const answer = await ragGenerate({ question, context_chunks: chunks, system_prompt });

    const elapsed = Date.now() - startMs;

    // Step 3 — persist query + answer to rag_queries
    const avgSimilarity =
      chunks.length > 0
        ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
        : 0;

    const client = await getPool().connect();
    let queryId: number | null = null;
    try {
      const qRes = await client.query<{ id: number }>(
        `INSERT INTO rag_queries (question, answer, sources_used, avg_similarity)
           VALUES ($1, $2, $3, $4) RETURNING id`,
        [question, answer, chunks.length, avgSimilarity.toFixed(4)],
      );
      queryId = qRes.rows[0]?.id ?? null;
    } finally {
      client.release();
    }

    return Response.json({
      answer,
      sources: chunks.map((c) => ({ title: c.title, similarity: c.similarity, source_type: c.source_type })),
      query_id: queryId,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    console.error('[RAG ask] error:', err);
    return Response.json({ error: 'RAG generation failed.' }, { status: 500 });
  }
}
