import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import crypto from 'crypto';

import { requireAdmin } from '@/lib/admin-auth';
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const res = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text.slice(0, 1000) }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { embedding?: number[] };
    return Array.isArray(data.embedding) ? data.embedding : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as { namespace?: string; content_text?: string; source_type?: string; metadata?: Record<string, unknown> };
    const { namespace, content_text, source_type, metadata } = body;

    if (content_text && namespace) {
      // Single doc insert
      const hash = crypto.createHash('sha256').update(content_text).digest('hex');
      const embedding = await generateEmbedding(content_text);

      const result = await pool.query(
        `INSERT INTO vector_store (namespace, source_type, content_text, content_hash, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (content_hash) DO UPDATE SET embedding = EXCLUDED.embedding
         RETURNING id`,
        [namespace, source_type ?? 'manual', content_text, hash,
         embedding.length ? JSON.stringify(embedding) : null,
         JSON.stringify(metadata ?? {})]
      );
      return Response.json({ ok: true, id: result.rows[0].id, embedding_dims: embedding.length });
    }

    // Batch: embed all rows in namespace that have no embedding yet
    const ns = namespace ?? 'default';
    const rows = await pool.query(
      'SELECT id, content_text FROM vector_store WHERE namespace = $1 AND embedding IS NULL LIMIT 50',
      [ns]
    );

    let processed = 0;
    for (const row of rows.rows as Array<{ id: number; content_text: string }>) {
      const emb = await generateEmbedding(row.content_text);
      if (emb.length > 0) {
        await pool.query(
          'UPDATE vector_store SET embedding = $1, embedding_model = $2 WHERE id = $3',
          [JSON.stringify(emb), 'nomic-embed-text', row.id]
        );
        processed++;
      }
    }

    return Response.json({ ok: true, namespace: ns, processed, total_pending: rows.rowCount });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
