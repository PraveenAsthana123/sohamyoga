export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema } from '@/lib/rag';

// ---------------------------------------------------------------------------
// GET /api/admin/rag/history — paginated query history
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    await ensureRagSchema();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    const client = await getPool().connect();
    try {
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM rag_queries`,
      );
      const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

      const res = await client.query<{
        id: number;
        question: string;
        answer: string;
        sources_used: number;
        avg_similarity: string;
        created_at: string;
      }>(
        `SELECT id, question, answer, sources_used, avg_similarity, created_at
           FROM rag_queries
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      return Response.json({
        queries: res.rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[RAG history] error:', err);
    return Response.json({ error: 'Failed to fetch query history.' }, { status: 500 });
  }
}
