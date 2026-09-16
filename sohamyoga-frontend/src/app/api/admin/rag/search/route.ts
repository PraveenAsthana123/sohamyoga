export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema, retrieveRelevant } from '@/lib/rag';

// ---------------------------------------------------------------------------
// POST /api/admin/rag/search — raw vector similarity search (no generation)
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
      query?: string;
      limit?: number;
      source_types?: string[];
      similarity_threshold?: number;
    };

    const { query, limit = 10, source_types, similarity_threshold = 0.6 } = body;

    if (!query || query.trim().length === 0) {
      return Response.json({ error: 'query is required.' }, { status: 400 });
    }

    const chunks = await retrieveRelevant({ query, limit, source_types, similarity_threshold });

    return Response.json({ results: chunks, count: chunks.length });
  } catch (err) {
    console.error('[RAG search] error:', err);
    return Response.json({ error: 'Semantic search failed.' }, { status: 500 });
  }
}
