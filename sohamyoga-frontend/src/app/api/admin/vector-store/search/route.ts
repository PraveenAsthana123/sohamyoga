import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as { query: string; namespace?: string; limit?: number };
    const { query, namespace, limit = 10 } = body;

    if (!query?.trim()) {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const conditions: string[] = ["to_tsvector('english', content_text) @@ plainto_tsquery('english', $1)"];
    const params: (string | number)[] = [query];
    let idx = 2;

    if (namespace) {
      conditions.push(`namespace = $${idx++}`);
      params.push(namespace);
    }

    params.push(limit);

    const result = await pool.query(
      `SELECT
         id, namespace, source_type, content_text,
         metadata,
         ts_rank(to_tsvector('english', content_text), plainto_tsquery('english', $1)) AS rank,
         created_at
       FROM vector_store
       WHERE ${conditions.join(' AND ')}
       ORDER BY rank DESC
       LIMIT $${idx}`,
      params
    );

    return Response.json({ results: result.rows, query, namespace });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
