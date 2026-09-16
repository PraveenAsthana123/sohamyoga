import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query: string; namespace?: string; limit?: number };
    const { query, namespace, limit = 10 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
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

    return NextResponse.json({ results: result.rows, query, namespace });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
