/**
 * VectorEmbeddingUpdateJob — runs daily at 2am UTC.
 * Processes up to 100 vector_store rows with empty embeddings per run.
 * Calls Ollama nomic-embed-text for each row. Graceful fallback if Ollama unavailable.
 */
import { pool } from '@/lib/db';

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const res = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text.slice(0, 1000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { embedding?: number[] };
    return Array.isArray(data.embedding) ? data.embedding : [];
  } catch {
    return [];
  }
}

export async function run(): Promise<void> {
  const rows = await pool.query(
    'SELECT id, content_text FROM vector_store WHERE embedding IS NULL ORDER BY id LIMIT 100'
  );

  if (rows.rowCount === 0) {
    console.log('[VectorEmbeddingUpdateJob] All vector_store rows already have embeddings — nothing to do.');
    return;
  }

  let processed = 0;
  let skipped = 0;

  for (const row of rows.rows as Array<{ id: number; content_text: string }>) {
    const emb = await generateEmbedding(row.content_text);
    if (emb.length > 0) {
      await pool.query(
        "UPDATE vector_store SET embedding = $1, embedding_model = 'nomic-embed-text' WHERE id = $2",
        [JSON.stringify(emb), row.id]
      );
      processed++;
    } else {
      skipped++;
    }
  }

  console.log(
    `[VectorEmbeddingUpdateJob] Done. Processed: ${processed}, Skipped (Ollama unavailable): ${skipped}`
  );
}
